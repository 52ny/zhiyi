import { describe, it, expect } from 'vitest';
import { createProvider, createMockProvider } from '../src/core/provider.js';

describe('AI Provider 契约', () => {
  it('拒绝未实现 chat 的适配器', () => {
    expect(() => createProvider({})).toThrow('chat');
    expect(() => createProvider(null)).toThrow('chat');
  });

  it('Mock 可返回固定文本并记录调用', async () => {
    const p = createMockProvider('正常');
    const out = await p.chat([{ role: 'user', content: '你好' }], { maxTokens: 10 });
    expect(out).toBe('正常');
    expect(p.calls.length).toBe(1);
    expect(p.calls[0].opts.maxTokens).toBe(10);
  });

  it('Mock 支持按输入动态生成', async () => {
    const p = createMockProvider((m) => '答：' + m[0].content);
    expect(await p.chat([{ role: 'user', content: '1+1' }])).toBe('答：1+1');
  });
});
