import { beforeEach, expect, it, vi } from 'vitest';
import data from '../../rules/search-rules.json';
import { parseRules } from '../domain/rules';
const fs = vi.hoisted(() => ({ mkdir: vi.fn(), writeTextFile: vi.fn(), rename: vi.fn(), exists: vi.fn(), readTextFile: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/plugin-fs', () => ({ ...fs, BaseDirectory: { AppConfig: 13 } }));
import { loadCachedRules, saveCachedRules } from './storage';

beforeEach(() => { vi.resetAllMocks(); });
it('writes a temporary cache before replacing the active cache', async () => {
  const rules = parseRules(JSON.stringify(data)); await saveCachedRules(rules);
  expect(fs.writeTextFile).toHaveBeenCalledWith('rules-cache.pending.json', JSON.stringify(rules,null,2), { baseDir: 13 });
  expect(fs.rename).toHaveBeenCalledWith('rules-cache.pending.json','rules-cache.json',{oldPathBaseDir:13,newPathBaseDir:13});
  expect(fs.writeTextFile.mock.invocationCallOrder[0]).toBeLessThan(fs.rename.mock.invocationCallOrder[0]);
});
it('does not replace the valid cache after a failed temporary write', async () => {
  fs.writeTextFile.mockRejectedValue(Error('disk full'));
  await expect(saveCachedRules(parseRules(JSON.stringify(data)))).rejects.toThrow('disk full');
  expect(fs.rename).not.toHaveBeenCalled();
});
it('returns null for missing cache without reading a file', async () => {
  fs.exists.mockResolvedValue(false); expect(await loadCachedRules()).toBeNull(); expect(fs.readTextFile).not.toHaveBeenCalled();
});
it('rejects corrupted cached JSON so startup can explicitly use the snapshot', async () => {
  fs.exists.mockResolvedValue(true); fs.readTextFile.mockResolvedValue('{broken');
  await expect(loadCachedRules()).rejects.toThrow();
});
