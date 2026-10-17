import { z } from 'zod';
import { parseTree, type Node as JsonNode } from 'jsonc-parser';

const nonempty = z.string().refine(v => v.trim().length > 0, '不能为空');
export const httpUrl = z.string().refine(v => {
  try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; }
  catch { return false; }
}, '必须是完整的 HTTP/HTTPS 地址，且不包含登录凭据');
const dateValid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const fieldSchema = z.strictObject({
  id: nonempty, label: nonempty, param: nonempty,
  type: z.enum(['text', 'date', 'select']), required: z.boolean(),
  defaultValue: z.string().optional(), placeholder: z.string().optional(),
  options: z.array(z.strictObject({ label: nonempty, value: nonempty })).optional(),
}).superRefine((f, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (f.type === 'select') {
    if (!f.options?.length) error('单选字段必须提供选项');
    if (new Set(f.options?.map(o => o.value)).size !== f.options?.length) error('选项值重复');
    if (f.defaultValue && !f.options?.some(o => o.value === f.defaultValue)) error('默认值不在选项中');
  } else if (f.options !== undefined) error('只有单选字段可包含 options');
  if (f.type === 'date' && f.defaultValue && !dateValid(f.defaultValue)) error('日期默认值无效');
});
const verification = z.strictObject({
  status: z.enum(['unverified', 'verified']), checkedAt: z.string().optional(),
  method: z.enum(['manual', 'official-docs']).optional(), notes: z.string().optional(), referenceUrl: httpUrl.optional(),
}).superRefine((v, ctx) => {
  if (v.checkedAt && !dateValid(v.checkedAt)) ctx.addIssue({ code: 'custom', message: '验证日期无效' });
  if (v.status === 'verified' && (!v.checkedAt || !v.method)) ctx.addIssue({ code: 'custom', message: '已验证规则缺少日期或方式' });
  if (v.method === 'official-docs' && !v.referenceUrl) ctx.addIssue({ code: 'custom', message: '官方文档验证需要依据链接' });
});
export const ruleSchema = z.strictObject({
  id: nonempty, name: nonempty, mode: z.literal('query'),
  baseUrl: httpUrl.refine(v => { try { const u = new URL(v); return !u.search && !u.hash && !v.includes('?') && !v.includes('#'); } catch { return false; } }, '基础地址不能包含查询部分或片段'),
  fixedParams: z.array(z.strictObject({ name: nonempty, value: z.string() })),
  fields: z.array(fieldSchema), verification,
}).superRefine((r, ctx) => {
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: `${label}重复` }); };
  unique(r.fields.map(f => f.id), '字段 ID'); unique(r.fields.map(f => f.param), '动态参数');
  if (r.fields.some(f => r.fixedParams.some(p => p.name === f.param))) ctx.addIssue({ code: 'custom', message: '固定参数与动态参数冲突' });
});
const siteSchema = z.strictObject({
  id: nonempty, name: nonempty, homepage: httpUrl, category: nonempty, notes: z.string().optional(), searchRules: z.array(ruleSchema),
}).superRefine((s, ctx) => { if (new Set(s.searchRules.map(r => r.id)).size !== s.searchRules.length) ctx.addIssue({ code: 'custom', message: '网站内规则 ID 重复' }); });
export const rulesSchema = z.strictObject({
  format: z.literal('academic-search-rules'), schemaVersion: z.literal(1), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), sites: z.array(siteSchema),
}).superRefine((r, ctx) => { if (new Set(r.sites.map(s => s.id)).size !== r.sites.length) ctx.addIssue({ code: 'custom', message: '网站 ID 重复' }); });

export type RuleSet = z.infer<typeof rulesSchema>;
export type Site = RuleSet['sites'][number];
export type SearchRule = Site['searchRules'][number];
export type Field = SearchRule['fields'][number];

export function parseRules(text: string): RuleSet {
  // JSON.parse enforces standard JSON. The syntax tree additionally detects duplicate keys.
  const value: unknown = JSON.parse(text);
  function visit(node: JsonNode) {
    if (node.type === 'object') {
      const names = (node.children ?? []).map(p => String(p.children?.[0]?.value));
      if (new Set(names).size !== names.length) throw new Error(`JSON 存在重复对象键（位置 ${node.offset}）`);
    }
    node.children?.forEach(visit);
  }
  const tree = parseTree(text); if (tree) visit(tree);
  const result = rulesSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.') || '规则集'}：${i.message}`).join('\n'));
  return result.data;
}

export function defaultInputs(rule: SearchRule): Record<string, string> {
  return Object.fromEntries(rule.fields.map(f => [f.id, f.defaultValue ?? '']));
}
export function buildSearchUrl(rule: SearchRule, inputs: Record<string, string>): string {
  const url = new URL(rule.baseUrl);
  for (const p of rule.fixedParams) url.searchParams.append(p.name, p.value);
  for (const f of rule.fields) {
    const value = Object.hasOwn(inputs, f.id) ? inputs[f.id] : f.defaultValue ?? '';
    if (!value.trim()) { if (f.required) throw new Error(`请填写${f.label}`); continue; }
    if (f.type === 'date' && !dateValid(value)) throw new Error(`${f.label}不是有效日期`);
    if (f.type === 'select' && !f.options?.some(o => o.value === value)) throw new Error(`${f.label}不在选项中`);
    url.searchParams.append(f.param, value);
  }
  return url.href;
}

export function chooseInitialRules(snapshot: RuleSet, cache: RuleSet | null) {
  return cache && cache.revision >= snapshot.revision ? { rules: cache, source: '本地缓存' } : { rules: snapshot, source: '内置快照' };
}
export function newerRules(current: RuleSet, remote: RuleSet): RuleSet | null {
  return remote.revision > current.revision ? remote : null;
}
