/**
 * 方案 B：可选后端同步（Supabase，本地优先）。
 * 未配置 URL/Key 时保持纯本地；配置后按 updatedAt 合并，冲突以较新者为准。
 */

/**
 * @param {{url?:string, anonKey?:string, token?:string, fetchImpl?:Function, table?:string}} opts
 */
export function createSupabaseSync(opts = {}) {
  const url = String(opts.url || '').replace(/\/+$/, '');
  const table = opts.table || 'zhiyi_docs';
  const fetchImpl = opts.fetchImpl || fetch;
  const headers = () => ({
    apikey: opts.anonKey,
    Authorization: 'Bearer ' + (opts.token || opts.anonKey),
    'Content-Type': 'application/json'
  });

  function ensure() {
    if (!url || !opts.anonKey) throw new Error('未配置 Supabase URL 与 anon key');
  }

  return {
    enabled: !!(url && opts.anonKey),

    async pull(userId) {
      ensure();
      const res = await fetchImpl(`${url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=doc_id,payload,updated_at`, { headers: headers() });
      if (!res.ok) throw new Error('拉取失败：HTTP ' + res.status);
      const rows = await res.json();
      return rows.map((r) => ({ id: r.doc_id, updatedAt: r.updated_at, doc: r.payload }));
    },

    async push(userId, docs) {
      ensure();
      const rows = (docs || []).map((d) => ({ user_id: userId, doc_id: d.id, payload: d, updated_at: new Date(d.updatedAt || Date.now()).toISOString() }));
      if (!rows.length) return 0;
      const res = await fetchImpl(`${url}/rest/v1/${table}?on_conflict=user_id,doc_id`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(rows)
      });
      if (!res.ok) throw new Error('上传失败：HTTP ' + res.status);
      return rows.length;
    },

    /** 以 updatedAt 较新者为准合并本地与远端 */
    merge(localDocs, remoteRows) {
      const map = new Map((localDocs || []).map((d) => [d.id, d]));
      for (const r of remoteRows || []) {
        const cur = map.get(r.id);
        if (!cur || (r.updatedAt && r.updatedAt > (cur.updatedAt || 0))) map.set(r.id, r.doc);
      }
      return Array.from(map.values());
    }
  };
}
