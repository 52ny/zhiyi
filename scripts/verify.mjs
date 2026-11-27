import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = process.cwd();
const fail = [];
const ok = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 1. JS 语法检查
const jsFiles = [...walk(resolve(root, 'assets/js')), resolve(root, 'sw.js')];
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    fail.push(`语法错误: ${f}\n${e.stderr?.toString() || e.message}`);
  }
}
ok.push(`JS 语法检查 ${jsFiles.length} 个文件`);

// 2. index.html 引用的本地资源必须存在
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => !/^(https?:|data:|#)/.test(u))
  .map((u) => u.split('?')[0]);
for (const r of refs) {
  if (!existsSync(resolve(root, r))) fail.push(`index.html 引用了不存在的资源: ${r}`);
}
ok.push(`index.html 资源引用 ${refs.length} 个`);

// 3. manifest 图标存在
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) {
  if (!existsSync(resolve(root, icon.src))) fail.push(`manifest 图标缺失: ${icon.src}`);
}
ok.push(`manifest 图标 ${(manifest.icons || []).length} 个`);

// 4. Service Worker 预缓存清单存在
const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
const core = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]).filter((p) => p !== './');
for (const p of core) {
  const file = p === './' ? 'index.html' : p.replace(/^\.\//, '');
  if (!existsSync(resolve(root, file))) fail.push(`SW 预缓存缺失: ${p}`);
}
ok.push(`SW 预缓存 ${core.length} 项`);

if (fail.length) {
  console.error('\n工程校验失败：\n' + fail.map((x) => ' - ' + x).join('\n'));
  process.exit(1);
}
console.log('工程校验通过：\n' + ok.map((x) => ' ✓ ' + x).join('\n'));
