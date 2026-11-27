import { describe, it, expect } from 'vitest';
import { loadZ } from './helpers.js';

const Z = loadZ(['assets/js/util.js', 'assets/js/importer.js']);

describe('语言识别', () => {
  it('识别英文', () => {
    expect(Z.langOf('Spaced repetition is one of the most effective study techniques.')).toBe('en');
  });

  it('识别中文', () => {
    expect(Z.langOf('间隔重复是认知科学中最有效的学习技术之一。')).toBe('zh');
  });

  it('识别文言文', () => {
    const text = '子曰：“学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？”';
    expect(Z.isClassical(text)).toBe(true);
  });

  it('不把现代文误判为文言文', () => {
    const text = '我们在学习函数的时候，需要先理解定义域和值域的概念，然后做一些练习，才能真正掌握它。';
    expect(Z.isClassical(text)).toBe(false);
  });
});

describe('OCR 典籍纠错', () => {
  it('修正空格、形近字与固定表述', () => {
    const raw = '6. 备 武 伯 问 孝 . FH: “父母 唯 其 疾 之 忧 .” 8. 村 夏 问 孝 . 子 日 : “色 难 .” 12.7H: “君子 不 船 。” 15. 子 日: “学 而 不 思 则 浆 ， 思 而 不 学 则 殉 .” 死 ， 葬 之 以 礼 ， 葬 之 以 礼 。';
    const fixed = Z.Import.fixClassicOcr(raw);
    expect(fixed).toContain('孟武伯问孝');
    expect(fixed).toContain('子曰：“父母唯其疾之忧。”');
    expect(fixed).toContain('子夏问孝。子曰：“色难。”');
    expect(fixed).toContain('君子不器');
    expect(fixed).toContain('学而不思则罔');
    expect(fixed).toContain('思而不学则殆');
    expect(fixed).toContain('葬之以礼，祭之以礼');
  });
});

describe('导入清洗', () => {
  it('去掉页码、广告与重复页眉', () => {
    const blocks = [
      { t: 'h1', text: '函数的概念' },
      { t: 'p', text: '第 3 页 共 10 页' },
      { t: 'p', text: '扫码关注公众号领取资料' },
      { t: 'p', text: '函数是描述两个集合之间对应关系的规则。' },
      { t: 'p', text: '函数是描述两个集合之间对应关系的规则。' },
      { t: 'p', text: '函数是描述两个集合之间对应关系的规则。' },
      { t: 'p', text: '定义域是自变量取值的集合。' }
    ];
    const out = Z.Import.cleanBlocks(blocks);
    expect(out.map((b) => b.text)).toEqual(['函数的概念', '定义域是自变量取值的集合。']);
  });

  it('按“只要题目”筛选时保留题干与选项', () => {
    const blocks = [
      { t: 'h1', text: '一次函数练习' },
      { t: 'p', text: '1. 已知一次函数 y=2x+1，求当 x=3 时的函数值。' },
      { t: 'p', text: 'A. 5  B. 6  C. 7  D. 8' },
      { t: 'p', text: '答案：C' },
      { t: 'p', text: '解析：代入 x=3 得 y=7。' },
      { t: 'p', text: '本页内容仅供课堂练习使用，请勿外传。' }
    ];
    const out = Z.Import.cleanBlocks(blocks, '只要题目');
    const text = out.map((b) => b.text).join('\n');
    expect(text).toContain('一次函数 y=2x+1');
    expect(text).toContain('答案：C');
    expect(text).toContain('解析：代入');
  });
});

describe('工具函数', () => {
  it('uid 不重复', () => {
    const set = new Set(Array.from({ length: 200 }, () => Z.uid('t')));
    expect(set.size).toBe(200);
  });
});
