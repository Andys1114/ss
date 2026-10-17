import { expect, it } from 'vitest';
import maintained from '../../rules/search-rules.json';
import { buildSearchUrl, parseRules } from './rules';

it('accepts the exact maintainer-owned file consumed by the application', () => {
  const rules = parseRules(JSON.stringify(maintained));
  expect(rules.sites.map(s => s.id)).toEqual(maintained.sites.map(s => s.id));
  for (const site of rules.sites) for (const rule of site.searchRules) {
    const inputs = Object.fromEntries(rule.fields.map(f => [f.id, f.type === 'date' ? '2026-10-17' : f.type === 'select' ? f.options![0].value : '中文 & + %']));
    const url = new URL(buildSearchUrl(rule,inputs));
    for (const field of rule.fields) expect(url.searchParams.get(field.param)).toBe(inputs[field.id]);
    for (const p of rule.fixedParams) expect(url.searchParams.getAll(p.name)).toContain(p.value);
  }
});
