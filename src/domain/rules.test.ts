import { describe, expect, it } from 'vitest';
import snapshot from './__fixtures__/rules.json';
import { buildSearchUrl, chooseInitialRules, defaultInputs, newerRules, parseRules, type SearchRule, type RuleSet } from './rules';

const valid = () => structuredClone(snapshot) as RuleSet;
const rule = () => parseRules(JSON.stringify(valid())).sites[0].searchRules[0];
function invalid(edit: (data: ReturnType<typeof valid>) => void) { const data = valid(); edit(data); expect(() => parseRules(JSON.stringify(data))).toThrow(); }
describe('public rule validation', () => {
  it('accepts bundled multi-rule sites and entry-only sites', () => { const r = parseRules(JSON.stringify(snapshot)); expect(r.sites).toHaveLength(10); expect(r.sites[0].searchRules).toHaveLength(2); expect(r.sites[1].searchRules).toEqual([]); });
  it('rejects duplicate JSON keys instead of silently replacing values', () => { expect(() => parseRules('{"a":1,"a":2}')).toThrow('重复对象键'); });
  it('rejects comments and trailing commas', () => { expect(() => parseRules('{"a":1,}')).toThrow(); expect(() => parseRules('{/*comment*/}')).toThrow(); });
  it('rejects unknown properties and unsupported versions', () => { invalid(d => Object.assign(d, { script: 'evil()' })); invalid(d => { Object.assign(d, { schemaVersion: 2 }); }); });
  it('rejects duplicate site and rule identifiers', () => { invalid(d => { d.sites[1].id = d.sites[0].id; }); invalid(d => { d.sites[0].searchRules[1].id = d.sites[0].searchRules[0].id; }); });
  it('rejects duplicate fields and conflicting parameters', () => { invalid(d => { d.sites[0].searchRules[0].fields.push(d.sites[0].searchRules[0].fields[0]); }); invalid(d => { d.sites[0].searchRules[0].fixedParams.push({ name: 'term', value: 'fixed' }); }); });
  it('rejects unsafe or malformed URLs without throwing raw URL errors', () => { invalid(d => { d.sites[0].homepage = 'javascript:alert(1)'; }); invalid(d => { d.sites[0].searchRules[0].baseUrl = 'invalid'; }); invalid(d => { d.sites[0].homepage = 'https://user:pass@example.org'; }); });
  it('rejects search or fragment components on baseUrl', () => { invalid(d => { d.sites[0].searchRules[0].baseUrl += '?term=x'; }); invalid(d => { d.sites[0].searchRules[0].baseUrl += '#x'; }); });
  it('rejects invalid select defaults, duplicate options and missing evidence', () => { invalid(d => { d.sites[0].searchRules[0].fields[1].defaultValue = 'unknown'; }); invalid(d => { const f = d.sites[0].searchRules[0].fields[1]; f.options!.push(f.options![0]); }); invalid(d => { d.sites[0].searchRules[0].verification.referenceUrl = ''; }); });
  it('rejects invalid release revisions', () => { invalid(d => { d.revision = 0; }); invalid(d => { d.revision = 1.5; }); });
});
describe('URL construction', () => {
  it('encodes Chinese, spaces, ampersands, plus and percent exactly once', () => { const value = '机器学习 & 教育 + 50%'; const u = new URL(buildSearchUrl(rule(), { keyword: value })); expect(u.searchParams.get('term')).toBe(value); expect([...u.searchParams.keys()]).toEqual(['term', 'sort']); });
  it('preserves repeated fixed parameters including empty values', () => { const r = rule(); r.fixedParams = [{ name: 'tag', value: 'a' }, { name: 'tag', value: 'b' }, { name: 'empty', value: '' }]; const u = new URL(buildSearchUrl(r, { keyword: 'test' })); expect(u.searchParams.getAll('tag')).toEqual(['a','b']); expect(u.searchParams.has('empty')).toBe(true); });
  it('uses defaults only for absent keys; does not reinstate cleared defaults', () => { const r = rule(); expect(new URL(buildSearchUrl(r, { keyword: 'a' })).searchParams.get('sort')).toBe('relevance'); expect(new URL(buildSearchUrl(r, { keyword: 'a', sort: '' })).searchParams.has('sort')).toBe(false); expect(defaultInputs(r).sort).toBe('relevance'); });
  it('blocks empty and whitespace-only required fields', () => { expect(() => buildSearchUrl(rule(), {})).toThrow('请填写关键词'); expect(() => buildSearchUrl(rule(), { keyword: '  ' })).toThrow(); });
  it('preserves the complete user expression and its nonempty whitespace', () => { const value = ' asthma AND review[pt] '; expect(new URL(buildSearchUrl(rule(), { keyword: value })).searchParams.get('term')).toBe(value); });
  it('validates dates and select input', () => { const r: SearchRule = rule(); r.fields.push({ id: 'date', label: '日期', param: 'from', type: 'date', required: false }); expect(() => buildSearchUrl(r, { keyword: 'a', date: '2026-02-30' })).toThrow('有效日期'); expect(new URL(buildSearchUrl(r, { keyword: 'a', date: '2024-02-29' })).searchParams.get('from')).toBe('2024-02-29'); expect(() => buildSearchUrl(r, { keyword: 'a', sort: 'evil' })).toThrow('不在选项'); });
});
describe('revision selection', () => {
  it('uses bundled snapshot on first offline launch', () => { const r = parseRules(JSON.stringify(snapshot)); expect(chooseInitialRules(r, null).source).toBe('内置快照'); });
  it('uses the newer accepted source, never a stale cache', () => { const r = parseRules(JSON.stringify(snapshot)), newer = { ...r, revision: r.revision + 1 }; expect(chooseInitialRules(r,newer).rules).toBe(newer); expect(chooseInitialRules(newer,r).rules).toBe(newer); });
  it('only proposes strictly newer remote data without mutating current rules', () => { const r = parseRules(JSON.stringify(snapshot)); expect(newerRules(r,r)).toBeNull(); const next = { ...r, revision: r.revision + 1 }; expect(newerRules(r,next)).toBe(next); expect(r.revision).toBe(snapshot.revision); expect(newerRules(next,r)).toBeNull(); });
});
