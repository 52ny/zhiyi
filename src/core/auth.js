/**
 * Supabase Auth：邮箱密码注册/登录 + 邮箱动态验证码（OTP）。
 * 未配置时完全不联网；会话仅存本机 localStorage。
 */
const SESSION_KEY = 'zhiyi.auth';

/**
 * @param {{url?:string, anonKey?:string, fetchImpl?:Function}} opts
 */
export function createAuth(opts = {}) {
  const url = String(opts.url || '').replace(/\/+$/, '');
  const key = opts.anonKey || '';
  const fetchImpl = opts.fetchImpl || fetch;
  const headers = () => ({ apikey: key, 'Content-Type': 'application/json' });

  function ensure() {
    if (!url || !key) throw new Error('未配置 Supabase URL 与 anon key');
  }

  async function call(path, body) {
    ensure();
    const res = await fetchImpl(url + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || '请求失败：HTTP ' + res.status);
    return data;
  }

  function saveSession(data) {
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user || null,
      savedAt: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  return {
    enabled: !!(url && key),
    signUp: (email, password) => call('/auth/v1/signup', { email, password }),
    signIn: async (email, password) => saveSession(await call('/auth/v1/token?grant_type=password', { email, password })),
    sendCode: (email) => call('/auth/v1/otp', { email, create_user: true }),
    resetPassword: (email) => call('/auth/v1/recover', { email }),
    verifyCode: async (email, token) => saveSession(await call('/auth/v1/verify', { type: 'email', email, token })),
    session() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
    },
    signOut() { localStorage.removeItem(SESSION_KEY); },
    async refresh() {
      const s = this.session();
      if (!s || !s.refreshToken) throw new Error('登录已过期，请重新登录');
      return saveSession(await call('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refreshToken }));
    }
  };
}
