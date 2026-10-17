import { newerRules, type RuleSet } from './rules';

/** Persist completely before making the new rules visible; failed writes leave the active rules untouched. */
export async function commitRulesUpdate(current: RuleSet, next: RuleSet, persist: (rules: RuleSet) => Promise<void>, activate: (rules: RuleSet) => void) {
  if (!newerRules(current, next)) throw new Error('待应用规则不是更新版本，请重新检查');
  await persist(next);
  activate(next);
}
