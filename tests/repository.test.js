import { describe, it, expect } from 'vitest';
import { createDocRepository } from '../src/core/repository.js';

function fakeAdapter() {
  const map = new Map();
  return {
    getDoc: async (id) => map.get(id) || null,
    allDocs: async () => Array.from(map.values()),
    putDoc: async (doc) => { map.set(doc.id, doc); return doc; },
    deleteDoc: async (doc) => { map.delete(doc.id); },
    clear: async () => { map.clear(); }
  };
}

describe('Document Repository 抽象', () => {
  it('通过统一接口读写文档', async () => {
    const repo = createDocRepository(fakeAdapter());
    await repo.save({ id: 'd1', title: '函数' });
    expect((await repo.get('d1')).title).toBe('函数');
    expect((await repo.all()).length).toBe(1);
    await repo.remove({ id: 'd1' });
    expect(await repo.get('d1')).toBeNull();
    await repo.clear();
    expect((await repo.all()).length).toBe(0);
  });

  it('适配器缺方法时立即报错', () => {
    expect(() => createDocRepository({ getDoc: async () => null })).toThrow('适配器缺少方法');
  });
});
