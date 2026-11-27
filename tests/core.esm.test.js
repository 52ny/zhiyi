// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import '../assets/js/util.js';
import { DB } from '../assets/js/db.js';
import { AI } from '../assets/js/ai.js';

describe('core 模块的 ESM 出口', () => {
  it('DB 可读写文档（jsdom 下走内存回退）', async () => {
    const doc = { id: 't1', title: '测试文档', blocks: [{ t: 'p', text: '内容' }] };
    await DB.putDoc(doc);
    const got = await DB.getDoc('t1');
    expect(got && got.title).toBe('测试文档');
  });

  it('AI 暴露统一接口与来源配置', () => {
    expect(typeof AI.chat).toBe('function');
    expect(typeof AI.ensureAgent).toBe('function');
    expect(AI.cfg().provider).toBeTruthy();
  });
});
