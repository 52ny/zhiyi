// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { langOf, isClassical, uid, esc } from '../assets/js/util.js';

describe('util 的 ESM 出口', () => {
  it('导出语言识别与文言判定', () => {
    expect(langOf('hello world')).toBe('en');
    expect(isClassical('子曰：“学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？”')).toBe(true);
  });

  it('导出 uid 与转义', () => {
    expect(uid('t')).toMatch(/^t_/);
    expect(esc('<b>"x"</b>')).not.toContain('<b>');
  });
});
