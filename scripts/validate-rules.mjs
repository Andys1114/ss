import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const file = process.argv[2] ?? 'rules/search-rules.json';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { parseRules } = await server.ssrLoadModule('/src/domain/rules.ts');
  const rules = parseRules(await readFile(file, 'utf8'));
  console.log(`有效规则 r${rules.revision}：${rules.sites.length} 个网站，${rules.sites.reduce((n,s)=>n+s.searchRules.length,0)} 条搜索规则`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await server.close(); }
