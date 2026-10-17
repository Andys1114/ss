import { defaultInputs, type SearchRule } from './rules';

/** The first text field is the manually entered shared search content; other fields stay rule-specific. */
export function sharedTextField(rule: SearchRule) {
  return rule.fields.find(field => field.type === 'text');
}

export function sharedSearchInputs(rule: SearchRule, content: string, overrides: Record<string, string> = {}) {
  const inputs = { ...defaultInputs(rule), ...overrides };
  const field = sharedTextField(rule);
  if (field) inputs[field.id] = content;
  return inputs;
}

export function ruleInputKey(siteId: string, ruleId: string) {
  return JSON.stringify([siteId, ruleId]);
}
