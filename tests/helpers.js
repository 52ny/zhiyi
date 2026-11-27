import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

/** 在 jsdom 中按页面顺序加载脚本，返回挂载好的 window.ZY */
export function loadZ(files) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  // 浏览器里由 vendor 脚本提供的全局依赖，测试中给出最小桩
  dom.window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('stub')) }) };
  dom.window.mammoth = {};
  dom.window.JSZip = function JSZip() {};
  for (const f of files) {
    // 兼容脚本内新增的 ESM export 行（jsdom 以脚本方式加载）
    const code = readFileSync(resolve(process.cwd(), f), 'utf8').replace(/^export\s+.*$/gm, '');
    dom.window.eval(code);
  }
  return dom.window.ZY;
}
