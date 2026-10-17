import { beforeEach, expect, it, vi } from 'vitest';
import data from '../../rules/search-rules.json';
import { parseRules } from '../domain/rules';
const io = vi.hoisted(() => ({ save: vi.fn(), writeTextFile: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: io.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: io.writeTextFile }));
import { exportRules } from './desktop';
beforeEach(() => { vi.resetAllMocks(); });
it('exports only the selected rules snapshot to the user-approved path', async () => {
  io.save.mockResolvedValue('D:/output/rules.json');
  const rules = parseRules(JSON.stringify(data));
  expect(await exportRules(rules)).toBe(true);
  expect(io.writeTextFile).toHaveBeenCalledWith('D:/output/rules.json', JSON.stringify(rules,null,2));
});
it('does not write a file when the save dialog is cancelled', async () => {
  io.save.mockResolvedValue(null);
  expect(await exportRules(parseRules(JSON.stringify(data)))).toBe(false);
  expect(io.writeTextFile).not.toHaveBeenCalled();
});
it('surfaces an export write failure instead of reporting success', async () => {
  io.save.mockResolvedValue('D:/output/rules.json'); io.writeTextFile.mockRejectedValue(Error('permission denied'));
  await expect(exportRules(parseRules(JSON.stringify(data)))).rejects.toThrow('permission denied');
});
