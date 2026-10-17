import { isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';
import { parseRules, type RuleSet } from '../domain/rules';

const prefsSchema = z.object({
  favorites: z.array(z.string()).default([]), order: z.array(z.string()).default([]), recent: z.array(z.string()).default([]),
  theme: z.enum(['light', 'dark', 'system']).default('system'), alwaysOnTop: z.boolean().default(false),
  width: z.number().min(320).max(900).default(360),
});
export type Preferences = z.infer<typeof prefsSchema>;
export const defaults = prefsSchema.parse({});
async function preferenceStore() { const { load } = await import('@tauri-apps/plugin-store'); return load('preferences.json', { autoSave: false, defaults: {} }); }
export async function loadPreferences(): Promise<Preferences> {
  const value = isTauri() ? await (await preferenceStore()).get('preferences') : JSON.parse(localStorage.getItem('scholar-preferences') ?? 'null');
  return prefsSchema.parse(value ?? {});
}
export async function savePreferences(prefs: Preferences) {
  if (!isTauri()) { localStorage.setItem('scholar-preferences', JSON.stringify(prefs)); return; }
  const store = await preferenceStore(); await store.set('preferences', prefs); await store.save();
}
export async function loadCachedRules(): Promise<RuleSet | null> {
  if (!isTauri()) { const raw = localStorage.getItem('scholar-rules'); return raw ? parseRules(raw) : null; }
  const { exists, readTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const opts = { baseDir: BaseDirectory.AppConfig };
  return await exists('rules-cache.json', opts) ? parseRules(await readTextFile('rules-cache.json', opts)) : null;
}
export async function saveCachedRules(rules: RuleSet) {
  const data = JSON.stringify(rules, null, 2);
  if (!isTauri()) { localStorage.setItem('scholar-rules', data); return; }
  const { mkdir, writeTextFile, rename, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const opts = { baseDir: BaseDirectory.AppConfig };
  await mkdir('', { ...opts, recursive: true });
  await writeTextFile('rules-cache.pending.json', data, opts);
  await rename('rules-cache.pending.json', 'rules-cache.json', { oldPathBaseDir: BaseDirectory.AppConfig, newPathBaseDir: BaseDirectory.AppConfig });
}
