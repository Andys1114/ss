// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openLink: vi.fn().mockResolvedValue(undefined), savePreferences: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../rules/search-rules.json', () => ({ default: {
  format:'academic-search-rules',schemaVersion:1,revision:1,sites:[
    {id:'pubmed',name:'PubMed',homepage:'https://pubmed.example.org/',category:'学术',searchRules:[
      {id:'papers',name:'论文',mode:'query',baseUrl:'https://pubmed.example.org/',fixedParams:[],verification:{status:'unverified'},fields:[{id:'keyword',label:'关键词',param:'term',type:'text',required:true},{id:'from',label:'开始日期',param:'from',type:'date',required:false}]},
      {id:'other',name:'其他方式',mode:'query',baseUrl:'https://pubmed.example.org/other',fixedParams:[],verification:{status:'unverified'},fields:[{id:'different-id',label:'词',param:'query',type:'text',required:true}]},
    ]},
    {id:'scholar',name:'Scholar',homepage:'https://scholar.example.org/',category:'学术',searchRules:[{id:'papers',name:'论文',mode:'query',baseUrl:'https://scholar.example.org/search',fixedParams:[],verification:{status:'unverified'},fields:[{id:'search-key',label:'搜索词',param:'q',type:'text',required:true}]}]},
    {id:'cnki',name:'知网',homepage:'https://cnki.example.org/',category:'中文',searchRules:[]},
  ],
} }));
vi.mock('./platform/storage', () => {
  const defaults = {favorites:[],order:[],recent:[],theme:'light',alwaysOnTop:false,width:360};
  return {defaults,loadPreferences:async()=>structuredClone(defaults),loadCachedRules:async()=>null,savePreferences:mocks.savePreferences,saveCachedRules:vi.fn()};
});
vi.mock('./platform/desktop', () => ({
  desktop:false,openLink:mocks.openLink,pinWindow:async()=>{},setWindowTheme:async()=>{},restoreWindowWidth:async()=>{},
  collapseWindow:async()=>{},dockRight:async()=>{},confirmDiscard:async()=>true,exportRules:async()=>true,fetchRulesText:vi.fn(),
}));
import App from './App';

let root: Root, host: HTMLDivElement;
beforeEach(async () => {
  vi.clearAllMocks();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT=true;
  host=document.createElement('div'); document.body.append(host); root=createRoot(host);
  await act(async()=>{root.render(<App/>);});
});
afterEach(async()=>{await act(async()=>root.unmount()); host.remove();});
const input=()=>host.querySelector<HTMLTextAreaElement>('#shared-content')!;
async function enter(value:string) { await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input(),value);input().dispatchEvent(new Event('input',{bubbles:true}));}); }
async function click(label:string) { const button=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.getAttribute('aria-label')===label);expect(button, label).toBeTruthy();await act(async()=>button!.click()); }

it('one click opens each website with the same unchanged content and its own parameter',async()=>{
  const content='中文 & graph + 50%';await enter(content);
  await click('在PubMed检索');await click('在Scholar检索');
  expect(mocks.openLink).toHaveBeenCalledTimes(2);
  expect(new URL(mocks.openLink.mock.calls[0][0]).searchParams.get('term')).toBe(content);
  expect(new URL(mocks.openLink.mock.calls[1][0]).searchParams.get('q')).toBe(content);
  expect(input().value).toBe(content);
});
it('entry-only buttons do not invent search parameters or clear the content',async()=>{
  await enter('keep this');await click('打开知网官网');
  expect(mocks.openLink).toHaveBeenCalledWith('https://cnki.example.org/');expect(input().value).toBe('keep this');
});
it('preview and favorite buttons never open websites or clear the query',async()=>{
  await enter('preserved');await click('预览Scholar链接');
  expect(mocks.openLink).not.toHaveBeenCalled();expect(input().value).toBe('preserved');
  const preview=host.querySelector<HTMLTextAreaElement>('[aria-label="最终 URL"]')!;
  expect(new URL(preview.value).searchParams.get('q')).toBe('preserved');
  await click('关闭链接预览');await click('收藏PubMed');
  expect(mocks.openLink).not.toHaveBeenCalled();expect(input().value).toBe('preserved');
});
it('keeps shared content and per-rule conditions when changing a rule and returning',async()=>{
  await enter('same');
  const date=host.querySelector<HTMLInputElement>('#option-pubmed-papers-from')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(date,'2026-10-17');date.dispatchEvent(new Event('input',{bubbles:true}));});
  const select=host.querySelector<HTMLSelectElement>('#rule-pubmed')!;
  await act(async()=>{select.value='other';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await click('在PubMed检索');expect(new URL(mocks.openLink.mock.calls.at(-1)![0]).searchParams.get('query')).toBe('same');
  await act(async()=>{select.value='papers';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await click('在PubMed检索');expect(new URL(mocks.openLink.mock.calls.at(-1)![0]).searchParams.get('from')).toBe('2026-10-17');
  expect(input().value).toBe('same');
});
it('missing required input prevents opening and leaves entry buttons usable',async()=>{
  await click('在PubMed检索');expect(mocks.openLink).not.toHaveBeenCalled();expect(host.textContent).toContain('请填写关键词');
  await click('打开知网官网');expect(mocks.openLink).toHaveBeenCalledOnce();
});

it('has no persistent footer or preview and keeps settings accessible in the header',async()=>{
  expect(host.querySelector('footer')).toBeNull();
  expect(host.querySelector('[aria-label="最终 URL"]')).toBeNull();
  expect(host.querySelector('.masthead [aria-label="设置"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="移动到显示器右侧"]')).toBeNull();
  await click('设置');
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('settings-title');
  await click('关闭设置');expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it('opens the preview only on demand, traps focus, and restores it on Escape without clearing content',async()=>{
  await enter('keep my query');
  const trigger=host.querySelector<HTMLButtonElement>('[aria-label="预览Scholar链接"]')!;trigger.focus();
  await click('预览Scholar链接');
  const dialog=host.querySelector('[role="dialog"]')!;
  expect(dialog.getAttribute('aria-labelledby')).toBe('preview-title');
  expect(host.querySelector('.main-content')?.hasAttribute('inert')).toBe(true);
  const close=host.querySelector<HTMLButtonElement>('[aria-label="关闭链接预览"]')!;
  expect(document.activeElement).toBe(close);
  const last=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),textarea')).at(-1)!;last.focus();
  await act(async()=>{last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));});
  expect(document.activeElement).toBe(close);
  await act(async()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});
  expect(host.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(trigger);
  expect(input().value).toBe('keep my query');expect(mocks.openLink).not.toHaveBeenCalled();
});
it('copies the current URL from the on-demand preview',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  await enter('中文 & text');await click('预览Scholar链接');await click('复制预览 URL');
  expect(writeText).toHaveBeenCalledOnce();expect(new URL(writeText.mock.calls[0][0]).searchParams.get('q')).toBe('中文 & text');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('链接已复制');
});
it('expands compact card conditions without losing the query or opening a website',async()=>{
  await enter('shared query');
  const details=host.querySelector<HTMLDetailsElement>('.destination-options')!;
  await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
  expect(details.closest('article')?.classList.contains('expanded')).toBe(true);
  await act(async()=>{details.open=false;details.dispatchEvent(new Event('toggle'));});
  expect(details.closest('article')?.classList.contains('expanded')).toBe(false);
  expect(input().value).toBe('shared query');expect(mocks.openLink).not.toHaveBeenCalled();
});
it('separates entry-only sites into small buttons without treating unverified search rules as entries',()=>{
  const searches=host.querySelector('[aria-labelledby="search-sites-title"]')!;
  const entries=host.querySelector('[aria-labelledby="entry-sites-title"]')!;
  expect(searches.querySelectorAll('.destination')).toHaveLength(2);
  expect(searches.querySelector('[aria-label="在PubMed检索"]')).not.toBeNull();
  expect(entries.querySelectorAll('.entry-button')).toHaveLength(1);
  expect(entries.querySelector('[aria-label="打开知网官网"]')).not.toBeNull();
  expect(entries.querySelector('.destination')).toBeNull();
});
it('keeps entry button preview and favorites usable without opening a website or changing content',async()=>{
  await enter('unchanged');await click('收藏知网');await click('预览知网链接');
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="最终 URL"]')?.value).toBe('https://cnki.example.org/');
  expect(mocks.openLink).not.toHaveBeenCalled();expect(input().value).toBe('unchanged');
  await click('关闭链接预览');
  const favorites=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='收藏')!;
  await act(async()=>favorites.click());
  expect(host.querySelector('[aria-labelledby="search-sites-title"]')).toBeNull();
  expect(host.querySelector('.entry-buttons [aria-label="取消收藏知网"]')).not.toBeNull();
  await click('打开知网官网');expect(mocks.openLink).toHaveBeenCalledWith('https://cnki.example.org/');expect(input().value).toBe('unchanged');
});
it('filters both groups and does not render empty group shells',async()=>{
  const filter=host.querySelector<HTMLInputElement>('[aria-label="筛选网站"]')!;
  async function filterBy(value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(filter,value);filter.dispatchEvent(new Event('input',{bubbles:true}));});}
  await filterBy('知网');
  expect(host.querySelector('[aria-labelledby="search-sites-title"]')).toBeNull();
  expect(host.querySelector('[aria-labelledby="entry-sites-title"]')).not.toBeNull();
  await filterBy('no matches');
  expect(host.querySelector('.destination-group')).toBeNull();expect(host.textContent).toContain('没有匹配的网站');
});
it('places square homepage shortcuts above the filters and search cards',()=>{
  const entries=host.querySelector('[aria-labelledby="entry-sites-title"]')!;
  const filter=host.querySelector('[aria-label="筛选网站"]')!;
  const searches=host.querySelector('[aria-labelledby="search-sites-title"]')!;
  expect(entries.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(entries.compareDocumentPosition(searches) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  expect(entries.querySelector('.entry-open .entry-mark[aria-hidden="true"]')).not.toBeNull();
  expect(entries.querySelector('.entry-open .entry-name')?.textContent).toBe('知网');
});
