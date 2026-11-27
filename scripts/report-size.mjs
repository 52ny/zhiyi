import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const root = join(process.cwd(), 'dist');
const rows = [];
let jsGzip = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const raw = statSync(p).size;
      const gz = gzipSync(readFileSync(p)).length;
      rows.push({ file: p.replace(root + '\\', '').replace(root + '/', ''), raw, gz });
      if (p.endsWith('.js')) jsGzip += gz;
    }
  }
}

walk(root);
rows.sort((a, b) => b.gz - a.gz);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

console.log('产物体积（gzip）：');
for (const r of rows.slice(0, 12)) console.log(`  ${r.file}  ${kb(r.raw)} → ${kb(r.gz)}`);
console.log(`\nJS 合计 gzip：${kb(jsGzip)}`);

const BUDGET = 400 * 1024;
if (jsGzip > BUDGET) {
  console.error(`超出预算：JS gzip ${kb(jsGzip)} > ${kb(BUDGET)}`);
  process.exit(1);
}
console.log(`预算通过（≤ ${kb(BUDGET)}）`);
