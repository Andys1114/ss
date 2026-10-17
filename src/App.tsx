import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, Check, ChevronLeft, ChevronsRight, Copy, Download, ExternalLink, Grip, History, Info, LoaderCircle, PanelRightClose, Pin, RefreshCw, Search, Settings, ShieldCheck, Star, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import bundled from '../rules/search-rules.json';
import { buildSearchUrl, chooseInitialRules, newerRules, parseRules, type RuleSet, type Site } from './domain/rules';
import { commitRulesUpdate } from './domain/updates';
import { defaults, loadCachedRules, loadPreferences, saveCachedRules, savePreferences, type Preferences } from './platform/storage';
import { collapseWindow, confirmDiscard, desktop, dockRight, exportRules, fetchRulesText, openLink, pinWindow, restoreWindowWidth, setWindowTheme } from './platform/desktop';
import { IconButton } from './components/IconButton';
import { SiteActions } from './components/SiteActions';
import { EntryButton } from './components/EntryButton';
import { ruleInputKey, sharedSearchInputs } from './domain/shared-search';

const snapshot = parseRules(JSON.stringify(bundled));
const feedUrl = (import.meta.env.VITE_RULES_URL ?? '').trim();
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export default function App() {
  const [rules, setRules] = useState(snapshot), [source, setSource] = useState('内置快照');
  const [prefs, setPrefs] = useState<Preferences>(defaults), [ready, setReady] = useState(false);
  const [previewSiteId, setPreviewSiteId] = useState('pubmed');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [content, setContent] = useState(''), [dirty, setDirty] = useState(false);
  const [ruleChoices, setRuleChoices] = useState<Record<string,string>>({});
  const [conditions, setConditions] = useState<Record<string,Record<string,string>>>({});
  const [query, setQuery] = useState(''), [category, setCategory] = useState('全部分类'), [tab, setTab] = useState('全部');
  const [settings, setSettings] = useState(false), [collapsed, setCollapsed] = useState(false), [notice, setNotice] = useState('');
  const [pending, setPending] = useState<RuleSet | null>(null), [checking, setChecking] = useState(false), [applying, setApplying] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(feedUrl ? '尚未检查' : '未配置在线规则，使用本地版本');
  const searchInput = useRef<HTMLTextAreaElement>(null), checkingRef = useRef(false), applyingRef = useRef(false);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  const current = useRef(snapshot), prefRef = useRef(defaults), collapsedRef = useRef(false), saveQueue = useRef(Promise.resolve());
  const site = rules.sites.find(s => s.id === previewSiteId) ?? rules.sites.find(s => s.searchRules.length) ?? rules.sites[0];
  const ruleFor = (target: Site) => target.searchRules.find(r => r.id === ruleChoices[target.id]) ?? target.searchRules[0];
  const rule = site && ruleFor(site);
  const inputsFor = (target: Site) => { const r = ruleFor(target); return r ? sharedSearchInputs(r,content,conditions[ruleInputKey(target.id,r.id)]) : {}; };

  const checkUpdates = useCallback(async (silent = false) => {
    if (checkingRef.current) return;
    if (!feedUrl) { setUpdateStatus('未配置在线规则，使用本地版本'); if (!silent) setNotice('维护者尚未配置规则发布地址'); return; }
    checkingRef.current = true; setChecking(true); setUpdateStatus('正在检查规则更新…');
    try {
      const remote = parseRules(await fetchRulesText(feedUrl));
      const next = newerRules(current.current, remote); setPending(next);
      setUpdateStatus(next ? `发现新版本 r${next.revision}，等待应用` : remote.revision < current.current.revision ? '云端版本较旧，保留当前规则' : '已是最新规则');
    } catch (e) { setUpdateStatus(`检查失败，保留当前规则：${message(e)}`); }
    finally { checkingRef.current = false; setChecking(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let cache: RuleSet | null = null, loaded = defaults;
      const warnings: string[] = [];
      try { loaded = await loadPreferences(); } catch (e) { warnings.push(`个人设置加载失败：${message(e)}`); }
      try { cache = await loadCachedRules(); } catch (e) { warnings.push(`缓存无效，已使用内置快照：${message(e)}`); }
      if (!alive) return;
      const initial = chooseInitialRules(snapshot, cache); current.current = initial.rules;
      setRules(initial.rules); setSource(initial.source); prefRef.current = loaded; setPrefs(loaded); setReady(true);
      try { await pinWindow(loaded.alwaysOnTop); await setWindowTheme(loaded.theme); await restoreWindowWidth(loaded.width); } catch (e) { warnings.push(`窗口设置失败：${message(e)}`); }
      if (warnings.length) setNotice(warnings.join('；'));
      void checkUpdates(true);
    })();
    return () => { alive = false; };
  }, [checkUpdates]);

  useEffect(() => {
    if (!settings && !previewOpen) return;
    const previous = dialogTrigger.current ?? document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [settings, previewOpen]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    const handler = (event: KeyboardEvent) => {
      if (!settings && !previewOpen && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === 'Escape') { if (previewOpen) setPreviewOpen(false); else { setSettings(false); setQuery(''); } }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [prefs.theme, settings, previewOpen]);
  useEffect(() => {
    if (!desktop || !ready) return;
    const unlisten = getCurrentWindow().onResized(async () => {
      if (collapsedRef.current) return;
      const win = getCurrentWindow(), width = (await win.innerSize()).width / await win.scaleFactor();
      if (width >= 320 && width <= 900) updatePrefs({ width });
    });
    return () => { void unlisten.then(fn => fn()); };
  }, [ready]);

  function updatePrefs(patch: Partial<Preferences>) {
    const next = { ...prefRef.current, ...patch }; prefRef.current = next; setPrefs(next);
    saveQueue.current = saveQueue.current.then(() => savePreferences(next)).catch(e => { setNotice(`设置未保存：${message(e)}`); });
  }
  async function action(task: () => Promise<unknown>) { try { await task(); } catch (e) { setNotice(message(e)); } }
  function showSettings() { dialogTrigger.current = document.activeElement as HTMLElement | null; setSettings(true); }
  function showPreview(id: string) { dialogTrigger.current = document.activeElement as HTMLElement | null; setPreviewSiteId(id); setPreviewOpen(true); }
  async function toggleCollapse() {
    const next = !collapsed;
    collapsedRef.current = true;
    try { await collapseWindow(next, prefRef.current.width); setCollapsed(next); collapsedRef.current = next; }
    catch (e) { collapsedRef.current = collapsed; setNotice(message(e)); }
  }
  async function applyUpdate() {
    if (!pending || applyingRef.current) return;
    applyingRef.current = true; setApplying(true);
    try {
      if (dirty && !await confirmDiscard()) return;
      await commitRulesUpdate(current.current, pending, saveCachedRules, next => {
        current.current = next; setRules(next); setSource('本地缓存'); setPending(null); setDirty(false);
        setContent(''); setConditions({}); setRuleChoices({});
        setNotice(`已应用规则 r${next.revision}`); setUpdateStatus('已是最新规则');
      });
    } catch (e) { setNotice(`应用失败，原规则保持不变：${message(e)}`); }
    finally { applyingRef.current = false; setApplying(false); }
  }
  let url = '', inputError = '';
  if (site) { if (!rule) url = site.homepage; else try { url = buildSearchUrl(rule, inputsFor(site)); } catch (e) { inputError = message(e); } }
  const categories = ['全部分类', ...new Set(rules.sites.map(s => s.category))];
  const visible = useMemo(() => {
    let list = rules.sites.filter(s => `${s.name} ${s.category}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (category === '全部分类' || s.category === category));
    if (tab === '收藏') list = list.filter(s => prefs.favorites.includes(s.id));
    if (tab === '最近') list = list.filter(s => prefs.recent.includes(s.id));
    const order = tab === '最近' ? prefs.recent : prefs.order;
    return [...list].sort((a, b) => (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)));
  }, [rules, query, category, tab, prefs.order, prefs.favorites, prefs.recent]);
  const searchSites = visible.filter(target => target.searchRules.length > 0);
  const entrySites = visible.filter(target => target.searchRules.length === 0);
  function toggleFavorite(id: string) {
    const favorites = prefRef.current.favorites;
    updatePrefs({ favorites: favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id] });
  }
  function moveSite(id: string, delta: number) {
    const ids = [...prefs.order.filter(id => rules.sites.some(s => s.id === id)), ...rules.sites.map(s => s.id).filter(id => !prefs.order.includes(id))];
    const i = ids.indexOf(id), j = i + delta; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; updatePrefs({ order: ids });
  }
  async function executeSite(target: Site) {
    if (!ready || applying) return;
    setPreviewSiteId(target.id);
    await action(async () => {
      const targetRule = ruleFor(target);
      const targetUrl = targetRule ? buildSearchUrl(targetRule,inputsFor(target)) : target.homepage;
      await openLink(targetUrl);
      updatePrefs({ recent: [target.id, ...prefRef.current.recent.filter(id => id !== target.id)].slice(0, 8) });
    });
  }
  function changeCondition(target: Site, fieldId: string, value: string) {
    const targetRule = ruleFor(target); if (!targetRule) return;
    const key = ruleInputKey(target.id,targetRule.id);
    setConditions(previous => ({ ...previous, [key]: { ...previous[key], [fieldId]: value } }));
    setPreviewSiteId(target.id); setDirty(true);
  }

  if (collapsed) return <main className="collapsed-shell"><img src="/brand.svg" alt="研途"/><span>研途</span><IconButton label="恢复侧边栏" onClick={() => void toggleCollapse()}><ChevronLeft size={22}/></IconButton><span className="vertical-hint">学术检索</span></main>;

  return <main className="app-shell" aria-busy={!ready}>
    <div className="main-content" inert={settings || previewOpen}>
    <header className="masthead">
      <div className="brand"><img src="/brand.svg" alt=""/><div><h1>研途<span>学术检索</span></h1><p>SCHOLAR RAIL</p></div></div>
      <div className="window-actions">
        <IconButton label="设置" aria-expanded={settings} onClick={showSettings}><Settings size={16}/></IconButton>
        <IconButton label={prefs.alwaysOnTop ? '取消置顶' : '窗口置顶'} disabled={!desktop || !ready} aria-pressed={prefs.alwaysOnTop} onClick={() => void action(async () => { await pinWindow(!prefs.alwaysOnTop); updatePrefs({ alwaysOnTop: !prefs.alwaysOnTop }); })}><Pin size={16}/></IconButton>
        <IconButton label="收起侧边栏" onClick={() => void toggleCollapse()}><PanelRightClose size={17}/></IconButton>
      </div>
    </header>
    <div className="search-body">
      <section className="shared-composer" aria-label="共享搜索内容">
        <div className="composer-heading"><div><span className="eyebrow">ONE QUERY, MANY SOURCES</span><h2>想检索什么？</h2></div><span className="content-count">{content.length} 字</span></div>
        <label className="sr-only" htmlFor="shared-content">搜索内容</label>
        <textarea id="shared-content" ref={searchInput} value={content} disabled={!ready || applying} placeholder="输入关键词、论文标题或完整检索式…" onChange={event => { setContent(event.target.value); setDirty(true); }}/>
        <div className="composer-caption"><span>输入一次，点击不同网站继续检索</span><button type="button" disabled={!content} onClick={() => { setContent(''); setDirty(true); searchInput.current?.focus(); }}>清空</button></div>
        {notice && !settings && !previewOpen && <div className="notice composer-notice" role="status"><Info size={14}/><span>{notice}</span><IconButton label="关闭提示" onClick={() => setNotice('')}><X size={13}/></IconButton></div>}
        {pending && <button className="update-banner composer-update" onClick={showSettings}><RefreshCw size={13}/>规则 r{pending.revision} 可更新<span>查看 <ArrowRight size={12}/></span></button>}
      </section>
      <section className="destinations" aria-label="网站检索按钮">
        <div className="destination-groups">
          {entrySites.length > 0 && <section className="destination-group entry-group" aria-labelledby="entry-sites-title">
            <div className="group-heading"><h4 id="entry-sites-title">网站入口</h4><span>仅打开官网 · {entrySites.length} 个</span></div>
            <div className="entry-buttons">{entrySites.map(target => <EntryButton key={target.id} site={target} disabled={!ready || applying} favorite={prefs.favorites.includes(target.id)} onOpen={() => void executeSite(target)} onPreview={() => showPreview(target.id)} onFavorite={() => toggleFavorite(target.id)}/>)}</div>
          </section>}
          <div className="destination-controls">
        <div className="destinations-heading"><h3>选择检索去向</h3><span>点击即打开 <ExternalLink size={12}/></span></div>
        <div className="finder"><Search size={16}/><input aria-label="筛选网站" placeholder="筛选网站名称" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <div className="nav-toolbar"><div className="tabs">{['全部','收藏','最近'].map(t => <button key={t} className={tab === t ? 'active' : ''} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === '收藏' ? <Star size={12}/> : t === '最近' ? <History size={12}/> : null}{t}</button>)}</div><select aria-label="网站分类" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          {searchSites.length > 0 && <section className="destination-group" aria-labelledby="search-sites-title">
            <div className="group-heading"><h4 id="search-sites-title">搜索网站</h4><span>{searchSites.length} 个</span></div>
            <div className="destination-list">{searchSites.map(target => { const targetRule=ruleFor(target); return <SiteActions key={target.id} site={target} rule={targetRule} values={targetRule ? conditions[ruleInputKey(target.id,targetRule.id)] ?? {} : {}} disabled={!ready || applying} favorite={prefs.favorites.includes(target.id)} previewing={previewOpen && site?.id === target.id} onOpen={() => void executeSite(target)} onPreview={() => showPreview(target.id)} onFavorite={() => toggleFavorite(target.id)} onRule={id => { setRuleChoices(previous=>({...previous,[target.id]:id})); setPreviewSiteId(target.id); }} onField={(id,value)=>changeCondition(target,id,value)}/>; })}</div>
          </section>}
          {!visible.length && <div className="empty">{tab === '收藏' ? '点击星标，收藏常用检索去向。' : tab === '最近' ? '打开网站后，会在这里留下入口。' : '没有匹配的网站，试试其他名称。'}</div>}
        </div>
      </section>
    </div>

    </div>

    {previewOpen && site && <div className="preview-layer"><section className="preview-panel" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <header><div><span className="eyebrow">链接预览</span><h2 id="preview-title">{site.name}</h2></div><IconButton label="关闭链接预览" onClick={() => setPreviewOpen(false)}><X size={18}/></IconButton></header>
      <textarea aria-label="最终 URL" readOnly value={url || inputError} className={!url ? 'url-empty' : ''}/>
      <button className="secondary-button preview-copy" aria-label="复制预览 URL" disabled={!url || !ready || applying} onClick={() => void action(async () => { await navigator.clipboard.writeText(url); setNotice('链接已复制'); })}><Copy size={15}/>复制链接</button>
      {rule && <div className={'verification ' + (rule.verification.status === 'verified' ? '' : 'unverified')}><ShieldCheck size={12}/><span>{rule.verification.status === 'verified' ? '已验证规则' : '未经验证 · 请核对条件'}</span>{rule.verification.referenceUrl && <button className="text-link" onClick={() => void action(() => openLink(rule.verification.referenceUrl!))}>查看依据 <ExternalLink size={11}/></button>}</div>}
      {notice && <div className="notice preview-notice" role="status"><Info size={14}/><span>{notice}</span><IconButton label="关闭提示" onClick={() => setNotice('')}><X size={13}/></IconButton></div>}
    </section></div>}

    {settings && <div className="settings-layer"><section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><span className="eyebrow">PREFERENCES</span><h2 id="settings-title">工具设置</h2></div><IconButton label="关闭设置" onClick={() => setSettings(false)}><X size={18}/></IconButton></header>
      <div className="settings-scroll">{notice && <div className="notice" role="status"><Info size={14}/><span>{notice}</span><IconButton label="关闭提示" onClick={() => setNotice('')}><X size={13}/></IconButton></div>}<h3>规则与更新</h3><p className="settings-description">公共规则由维护者统一发布。检索内容不会上传到规则服务。</p><div className="status-card"><span>{source} <b>r{rules.revision}</b></span><p role="status">{updateStatus}</p></div>
      <div className="button-pair"><button className="secondary-button" disabled={checking || applying || !ready} onClick={() => void checkUpdates()}>{checking ? <LoaderCircle size={14} className="spin"/> : <RefreshCw size={14}/>}检查规则更新</button><button className="secondary-button" onClick={() => void action(async () => { if (await exportRules(rules)) setNotice('规则已导出'); })}><Download size={14}/>导出 JSON</button></div>
      {pending && <button className="primary-button apply-button" disabled={applying} onClick={() => void applyUpdate()}>{applying ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>}应用规则 r{pending.revision}</button>}
      <h3>外观与窗口</h3><label className="setting-row">主题<select aria-label="主题" value={prefs.theme} onChange={e => void action(async () => { const theme = e.target.value as Preferences['theme']; await setWindowTheme(theme); updatePrefs({ theme }); })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><button className="setting-row row-button" disabled={!desktop} onClick={() => void action(async () => { await pinWindow(!prefs.alwaysOnTop); updatePrefs({ alwaysOnTop: !prefs.alwaysOnTop }); })}><span>窗口置顶</span><span className={`switch ${prefs.alwaysOnTop ? 'on' : ''}`}><i/></span></button><button className="setting-row row-button" disabled={!desktop} onClick={() => void action(dockRight)}><span>贴靠当前显示器右侧</span><ChevronsRight size={16}/></button>
      <h3>网站排序</h3><p className="settings-description">调整网站按钮和收藏中的显示顺序。</p>{[...rules.sites].sort((a,b) => { const ids = [...prefs.order, ...rules.sites.map(s=>s.id).filter(id=>!prefs.order.includes(id))]; return ids.indexOf(a.id)-ids.indexOf(b.id); }).map(s => <div className="order-row" key={s.id}><Grip size={14}/><span>{s.name}</span><IconButton label={`上移${s.name}`} onClick={() => moveSite(s.id,-1)}><ArrowUp size={13}/></IconButton><IconButton label={`下移${s.name}`} onClick={() => moveSite(s.id,1)}><ArrowDown size={13}/></IconButton></div>)}
      <div className="about"><BookOpen size={16}/><span>研途 Scholar Rail · 0.1.0<br/><small>人工检索辅助 · 不读取网页或抓取结果</small></span></div></div>
    </section></div>}
  </main>;
}
