// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createAuth } from '../src/core/auth.js';

function mock(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body || '{}'), headers: init.headers });
    return { ok: true, status: 200, json: async () => responses.shift() || {} };
  };
  return { calls, fetchImpl };
}

describe('Supabase Auth', () => {
  it('未配置时拒绝请求', async () => {
    const a = createAuth({});
    expect(a.enabled).toBe(false);
    await expect(a.signIn('a@b.c', 'x')).rejects.toThrow('未配置');
  });

  it('密码登录保存会话', async () => {
    const { calls, fetchImpl } = mock([{ access_token: 'at', refresh_token: 'rt', user: { id: 'u1' } }]);
    const a = createAuth({ url: 'https://x.supabase.co', anonKey: 'k', fetchImpl });
    const s = await a.signIn('a@b.c', 'pass1234');
    expect(s.user.id).toBe('u1');
    expect(calls[0].url).toContain('grant_type=password');
    expect(a.session().accessToken).toBe('at');
    a.signOut();
    expect(a.session()).toBeNull();
  });

  it('发送并校验邮箱验证码', async () => {
    const { calls, fetchImpl } = mock([{}, { access_token: 'at2', refresh_token: 'rt2', user: { id: 'u2' } }]);
    const a = createAuth({ url: 'https://x.supabase.co', anonKey: 'k', fetchImpl });
    await a.sendCode('a@b.c');
    expect(calls[0].url).toContain('/auth/v1/otp');
    const s = await a.verifyCode('a@b.c', '123456');
    expect(calls[1].body).toMatchObject({ type: 'email', email: 'a@b.c', token: '123456' });
    expect(s.user.id).toBe('u2');
  });
});
