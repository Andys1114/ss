import { expect, it, vi } from 'vitest';
import data from './__fixtures__/rules.json';
import { parseRules } from './rules';
import { commitRulesUpdate } from './updates';

it('does not activate while persistence is still pending', async () => {
  const current = parseRules(JSON.stringify(data)), next = { ...current, revision: current.revision + 1 };
  let finish!: () => void;
  const persist = () => new Promise<void>(resolve => { finish = resolve; });
  const activate = vi.fn(), task = commitRulesUpdate(current, next, persist, activate);
  expect(activate).not.toHaveBeenCalled(); finish(); await task; expect(activate).toHaveBeenCalledWith(next);
});
it('keeps active rules unchanged when a cache write fails', async () => {
  const current = parseRules(JSON.stringify(data)), next = { ...current, revision: current.revision + 1 }, activate = vi.fn();
  await expect(commitRulesUpdate(current, next, async () => { throw Error('disk full'); }, activate)).rejects.toThrow('disk full');
  expect(activate).not.toHaveBeenCalled(); expect(current.revision).toBe(data.revision);
});
it('does not persist an equal or older pending version', async () => {
  const current = parseRules(JSON.stringify(data)), persist = vi.fn(), activate = vi.fn();
  await expect(commitRulesUpdate(current,current,persist,activate)).rejects.toThrow('不是更新版本');
  expect(persist).not.toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled();
});
