import { expect, it } from 'vitest';
import data from '../../rules/search-rules.json';
import { buildSearchUrl, parseRules, type SearchRule } from './rules';
import { ruleInputKey, sharedSearchInputs } from './shared-search';

it('reuses exactly the same content across differing site parameter and field names', () => {
  const content = '中文 & education + 50%';
  for (const site of parseRules(JSON.stringify(data)).sites) for (const rule of site.searchRules) {
    const field = rule.fields.find(f => f.type === 'text'); if (!field) continue;
    const inputs = sharedSearchInputs(rule,content,Object.fromEntries(rule.fields.filter(f=>f.type==='date').map(f=>[f.id,'2026-10-17'])));
    expect(new URL(buildSearchUrl(rule,inputs)).searchParams.get(field.param)).toBe(content);
  }
});
it('keeps extra conditions and optional cleared defaults independent of shared content', () => {
  const rule: SearchRule = {id:'a',name:'a',mode:'query',baseUrl:'https://example.org/',fixedParams:[],verification:{status:'unverified'},fields:[
    {id:'keyword',label:'词',param:'q',type:'text',required:true,defaultValue:'*'},
    {id:'from',label:'日期',param:'from',type:'date',required:false},
    {id:'sort',label:'排序',param:'sort',type:'text',required:false,defaultValue:'newest'},
  ]};
  expect(sharedSearchInputs(rule,'kept',{from:'2026-10-17',sort:''})).toEqual({keyword:'kept',from:'2026-10-17',sort:''});
  expect(sharedSearchInputs(rule,'').keyword).toBe('');
});
it('does not collide rule-specific conditions when identifiers contain punctuation', () => {
  expect(ruleInputKey('a/b','c')).not.toBe(ruleInputKey('a','b/c'));
});
