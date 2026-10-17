import { isTauri } from '@tauri-apps/api/core';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { httpUrl, type RuleSet } from '../domain/rules';

export const desktop = isTauri();
export async function openLink(url: string) {
  httpUrl.parse(url);
  if (desktop) { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
  else window.open(url, '_blank', 'noopener,noreferrer');
}
export async function exportRules(rules: RuleSet) {
  const text = JSON.stringify(rules, null, 2);
  if (desktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const file = await save({ defaultPath: `search-rules-r${rules.revision}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!file) return false;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs'); await writeTextFile(file, text); return true;
  }
  const href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = href; link.download = `search-rules-r${rules.revision}.json`; link.click(); URL.revokeObjectURL(href); return true;
}
export async function fetchRulesText(url: string) {
  if (!url.startsWith('https://')) throw new Error('规则来源必须使用 HTTPS');
  const options = { signal: AbortSignal.timeout(15000), redirect: 'error' as const };
  const response = desktop
    ? await (await import('@tauri-apps/plugin-http')).fetch(url, { ...options, maxRedirections: 0, connectTimeout: 10000 })
    : await fetch(url, options);
  if (!response.ok) throw new Error(`规则下载失败：HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('规则文件超过 2 MB');
  return text;
}
export async function confirmDiscard() {
  const text = '应用规则更新将重新加载表单并清空当前输入。继续吗？';
  return desktop ? (await import('@tauri-apps/plugin-dialog')).confirm(text, { title: '应用规则更新', kind: 'warning', okLabel: '应用并清空', cancelLabel: '取消' }) : window.confirm(text);
}
export async function pinWindow(enabled: boolean) { if (desktop) await getCurrentWindow().setAlwaysOnTop(enabled); }
export async function setWindowTheme(theme: 'light' | 'dark' | 'system') { if (desktop) await getCurrentWindow().setTheme(theme === 'system' ? null : theme); }
export async function restoreWindowWidth(width: number) {
  if (!desktop) return;
  const win = getCurrentWindow(), scale = await win.scaleFactor(), size = await win.innerSize();
  await win.setSize(new LogicalSize(width, size.height / scale));
}
export async function dockRight() {
  if (!desktop) throw new Error('请在桌面应用中使用贴边功能');
  const monitor = await currentMonitor(); if (!monitor) throw new Error('无法获取当前显示器');
  const win = getCurrentWindow(), { position, size } = monitor.workArea;
  const current = await win.outerSize();
  await win.setPosition(new PhysicalPosition(position.x + Math.max(0, size.width - current.width), position.y));
  // Outer size already includes native titlebar; keep it within the work area.
  const inner = await win.innerSize();
  const chrome = current.height - inner.height;
  await win.setSize(new LogicalSize(inner.width / monitor.scaleFactor, Math.max(300, (size.height - chrome) / monitor.scaleFactor)));
}
export async function collapseWindow(collapsed: boolean, width: number) {
  if (!desktop) return;
  const win = getCurrentWindow(), size = await win.innerSize(), scale = await win.scaleFactor();
  const outer = await win.outerSize(), position = await win.outerPosition();
  await win.setMinSize(new LogicalSize(collapsed ? 92 : 320, 300));
  await win.setSize(new LogicalSize(collapsed ? 92 : width, size.height / scale));
  const next = await win.outerSize();
  await win.setPosition(new PhysicalPosition(position.x + outer.width - next.width, position.y));
}
