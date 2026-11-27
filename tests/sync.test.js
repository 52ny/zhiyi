import { describe, it, expect } from 'vitest';
import { createSupabaseSync } from '../src/core/sync.js';

function fakeFetch(calls, payload = []) {
  return async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => payload };
  };
}

describe('Supabase 同步（方案 B）', () => {
  it('未配置时 enabled=false 且调用报错', async () => {
    const s = createSupabaseSync({});
    expect(s.enabled).toBe(false);
    await expect(s.pull('u1')).rejects.toThrow();
  });

  it('pull 带上用户过滤与鉴权头', async () => {
    const calls = [];
    const s = createSupabaseSync({ url: 'https://x.supabase.co/', anonKey: 'k', token: 't', fetchImpl: fakeFetch(calls, [{ doc_id: 'd1', payload: { id: 'd1' }, updated_at: '2026-01-01T00:00:00Z' }]) });
    const rows = await s.pull('u1');
    expect(rows.length).toBe(1);
    expect(calls[0].url).toContain('user_id=eq.u1');
    expect(calls[0].init.headers.Authorization).toBe('Bearer t');
  });

  it('push 使用 upsert 并返回条数', async () => {
    const calls = [];
    const s = createSupabaseSync({ url: 'https://x.supabase.co', anonKey: 'k', fetchImpl: fakeFetch(calls) });
    const n = await s.push('u1', [{ id: 'd1', updatedAt: Date.now() }]);
    expect(n).toBe(1);
    expect(calls[0].url).toContain('on_conflict=user_id,doc_id');
    expect(calls[0].init.headers.Prefer).toContain('merge-duplicates');
  });

  it('合并时保留较新的文档', () => {
    const s = createSupabaseSync({});
    const local = [{ id: 'a', updatedAt: 100 }, { id: 'b', updatedAt: 300 }];
    const remote = [{ id: 'a', updatedAt: 200, doc: { id: 'a', updatedAt: 200 } }, { id: 'c', updatedAt: 150, doc: { id: 'c', updatedAt: 150 } }];
    const out = s.merge(local, remote);
    expect(out.find((d) => d.id === 'a').updatedAt).toBe(200);
    expect(out.find((d) => d.id === 'b').updatedAt).toBe(300);
    expect(out.find((d) => d.id === 'c').updatedAt).toBe(150);
  });
});
