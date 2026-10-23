/* 知忆 · 翻译与词典 */
(function (Z) {
  const memCache = new Map();
  const MAX_CACHE = 500;
  let diskCache = null;
  let flushTimer = null;

  function disk() {
    if (!diskCache) diskCache = Z.store.get('trCache', {});
    return diskCache;
  }
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!diskCache) return;
      const keys = Object.keys(diskCache);
      if (keys.length > MAX_CACHE) keys.slice(0, keys.length - MAX_CACHE).forEach((k) => delete diskCache[k]);
      try { Z.store.set('trCache', diskCache); } catch (e) {}
    }, 600);
  }
  function cacheGet(key) {
    if (memCache.has(key)) return memCache.get(key);
    const v = disk()[key];
    if (v) { memCache.set(key, v); return v; }
    return null;
  }
  function cacheSet(key, val) {
    memCache.set(key, val);
    if (memCache.size > MAX_CACHE) memCache.delete(memCache.keys().next().value);
    disk()[key] = val;
    scheduleFlush();
  }

  async function fetchT(url, opts = {}, ms = 5000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
    } finally { clearTimeout(timer); }
  }

  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const i = cursor++;
        try { out[i] = await fn(items[i], i); } catch (e) { out[i] = ''; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  function targetFor(lang) {
    if (lang === 'wenyan') return { code: 'zh', name: '白话文', pair: null, classical: true };
    if (lang === 'zh') return { code: 'en', name: '英语', pair: 'zh-CN|en' };
    if (lang === 'ja') return { code: 'zh', name: '中文', pair: 'ja|zh-CN' };
    return { code: 'zh', name: '中文', pair: 'en|zh-CN' };
  }

  function targetFromSetting(lang) {
    const pref = Z.store.get('translate.target', 'auto');
    if (pref === 'wenyan') return { code: 'zh', name: '白话文', pair: null, classical: true };
    if (pref === 'zh') return { code: 'zh', name: '中文', pair: null, classical: lang === 'wenyan' };
    if (pref === 'en') return { code: 'en', name: '英语', pair: null, classical: false };
    return targetFor(lang);
  }

  function pairFor(from, to) {
    const a = from === 'zh' ? 'zh-CN' : from === 'ja' ? 'ja' : 'en';
    const b = to === 'zh' ? 'zh-CN' : to === 'en' ? 'en' : to === 'ja' ? 'ja' : 'zh-CN';
    return a + '|' + b;
  }

  async function myMemory(text, pair) {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=' + encodeURIComponent(pair);
    const res = await fetchT(url, {}, 4500);
    if (!res.ok) throw new Error('翻译服务请求失败 (' + res.status + ')');
    const data = await res.json();
    if (data.quotaFinished) throw new Error('今日免费翻译额度已用完');
    const t = data.responseData?.translatedText;
    if (!t) throw new Error(data.responseDetails || '翻译失败');
    if (/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) throw new Error('翻译服务限流，请稍后重试');
    return t;
  }

  async function freeTranslate(text, from, to) {
    const key = 'mm:' + from + '>' + to + ':' + text;
    const hit = cacheGet(key);
    if (hit) return hit;
    const pair = pairFor(from, to);
    const sentences = Z.splitSentences(text);
    if (sentences.length > 1 && text.length > 420) {
      const parts = await mapLimit(sentences, 3, (s) => myMemory(s, pair));
      const val = parts.filter(Boolean).join(' ');
      if (val && from !== to && val.trim().toLowerCase() === text.trim().toLowerCase()) throw new Error('翻译无变化');
      if (val) cacheSet(key, val);
      return val;
    }
    const val = await myMemory(text, pair);
    // 接口把原文原样返回时视为失败，交给上层回退
    if (from !== to && val.trim().toLowerCase() === text.trim().toLowerCase()) throw new Error('翻译无变化');
    cacheSet(key, val);
    return val;
  }

  async function translateBlocks(texts, opts = {}) {
    const from = opts.fromLang || Z.langOf(texts.join(' '));
    const target = opts.to || targetFromSetting(from);
    const to = target.code;
    const classical = from === 'wenyan' || !!target.classical;
    const prefix = classical ? 'wy2:' : 'ai:';
    const ck = (t) => prefix + from + '>' + to + ':' + t;
    const out = new Array(texts.length).fill('');

    // 已缓存
    const pending = [];
    texts.forEach((t, i) => {
      const hit = cacheGet(ck(t));
      if (hit) out[i] = hit;
      else if (t.trim()) pending.push(i);
    });
    if (!pending.length) return out;

    // 文言文 → 白话文：只能由智能体完成
    if (classical) {
      if (!Z.AI.isChat()) throw new Error('文言文翻译需要内置智能体或云端 AI');
      const chunks = [];
      for (let k = 0; k < pending.length; k += 5) chunks.push(pending.slice(k, k + 5));
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        if (ci > 0) await Z.sleep(700);
        const payload = chunk.map((i) => `[${i}] ${texts[i]}`).join('\n');
        const raw = await Z.AI.chat([
          { role: 'system', content: '你是文言文翻译专家。必须把文言文改写成白话文（现代汉语），严禁照抄原文；逐段输出，格式为「[编号] 白话译文」，不要解释。' },
          { role: 'user', content: '示例：\n[0] 学而时习之，不亦说乎？\n[0] 学了知识并按时温习，不也很愉快吗？\n\n请翻译：\n' + payload }
        ], { temperature: 0.3, maxTokens: 2000 });
        raw.split(/\n+/).forEach((line) => {
          const m = line.match(/^\s*\[(\d+)\]\s*(.+)$/);
          if (m) {
            const i = Number(m[1]);
            if (i >= 0 && i < out.length) out[i] = m[2].trim();
          }
        });
        if (!chunk.some((i) => out[i])) {
          const lines = raw.split(/\n+/).map((x) => x.replace(/^\s*\[?\d+\]?\s*/, '').trim()).filter(Boolean);
          chunk.forEach((i, k) => { if (lines[k]) out[i] = lines[k]; });
        }
        // 模型照抄原文时视为失败，避免把原文当译文展示
        chunk.forEach((i) => { if (out[i] && out[i].trim() === texts[i].trim()) out[i] = ''; });
        if (opts.onProgress) opts.onProgress(chunk);
      }
      out.forEach((t, i) => { if (t) cacheSet(ck(texts[i]), t); });
      if (!out.some(Boolean)) throw new Error('文言文翻译未返回白话译文，请稍后重试');
      return out;
    }

    // 批量翻译默认走免费接口（更快）；AI 仅用于显式 preferAI 的场景
    const useAI = !!opts.preferAI && Z.AI.isChat();
    if (useAI) {
      try {
        const chunks = [];
        for (let k = 0; k < pending.length; k += 6) chunks.push(pending.slice(k, k + 6));
        for (const chunk of chunks) {
          const res = await Z.AI.translate(chunk.map((i) => texts[i]), from === 'zh' ? '中文' : from === 'ja' ? '日语' : '英语', to === 'zh' ? '中文' : '英语');
          res.forEach((t, k) => {
            if (t) {
              out[chunk[k]] = t;
              cacheSet('ai:' + from + '>' + to + ':' + texts[chunk[k]], t);
            }
          });
          if (opts.onProgress) opts.onProgress(chunk.map((i) => i));
        }
      } catch (e) {
        Z.toast('AI 翻译失败，已切换免费翻译：' + e.message, 'error', 3200);
      }
    }

    // 免费翻译兜底（并发 4，无额外等待）
    const rest = pending.filter((i) => !out[i]);
    let cursor = 0;
    async function worker() {
      while (cursor < rest.length) {
        const idx = rest[cursor++];
        try {
          out[idx] = await freeTranslate(texts[idx], from, to);
          cacheSet('ai:' + from + '>' + to + ':' + texts[idx], out[idx]);
        } catch (e) {
          out[idx] = '';
        }
        if (opts.onProgress) opts.onProgress([idx]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, rest.length) }, worker));
    const failed = rest.filter((i) => !out[i]);
    if (failed.length && failed.length === rest.length && Z.AI.isChat()) {
      // 免费接口整体不可用时，退回 AI 翻译，保证仍能出结果
      try {
        const chunks = [];
        for (let k = 0; k < failed.length; k += 6) chunks.push(failed.slice(k, k + 6));
        for (const chunk of chunks) {
          const res = await Z.AI.translate(chunk.map((i) => texts[i]), from === 'zh' ? '中文' : from === 'ja' ? '日语' : '英语', to === 'zh' ? '中文' : '英语');
          res.forEach((t, k) => {
            if (t) {
              out[chunk[k]] = t;
              cacheSet('ai:' + from + '>' + to + ':' + texts[chunk[k]], t);
            }
          });
          if (opts.onProgress) opts.onProgress(chunk);
        }
      } catch (e) {}
    }
    return out;
  }

  async function freeTranslateOne(text, from) {
    const target = targetFromSetting(from);
    return freeTranslate(text, from, target.code);
  }

  async function lookupWord(word) {
    const w = String(word || '').trim().replace(/[^A-Za-z'\-\u4e00-\u9fff]/g, '');
    if (!w) return null;
    const key = 'word:' + w.toLowerCase();
    const cacheAll = Z.store.get('wordCache', {});
    const hit = cacheAll[key];
    if (hit && (hit.cn || (hit.defs || []).length)) return hit;

    const isEn = /^[A-Za-z][A-Za-z'-]*$/.test(w);
    const result = { word: w, phonetic: '', defs: [], cn: '', lang: isEn ? 'en' : 'zh' };
    // 中文词语不做网络查询，直接朗读；避免无意义的等待
    if (!isEn) return result;

    const [dict, cn] = await Promise.allSettled([
      (async () => {
        const res = await fetchT('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), {}, 4200);
        if (!res.ok) return null;
        return res.json();
      })(),
      // 免费词典与智能体同时起跑，谁先给出中文释义用谁
      Promise.any([
        freeTranslate(w, 'en', 'zh'),
        (async () => {
          if (!Z.AI.isChat()) throw new Error('no ai');
          const arr = await Z.AI.translate([w], '英语', '中文');
          if (!arr || !arr[0]) throw new Error('empty');
          return arr[0];
        })()
      ])
    ]);
    if (dict.status === 'fulfilled' && Array.isArray(dict.value)) {
      const entry = dict.value[0] || {};
      result.phonetic = (entry.phonetics || []).map((p) => p.text).find(Boolean) || entry.phonetic || '';
      (entry.meanings || []).slice(0, 3).forEach((m) => {
        (m.definitions || []).slice(0, 2).forEach((d) => {
          result.defs.push({ pos: m.partOfSpeech, def: d.definition, example: d.example || '' });
        });
      });
    }
    if (cn.status === 'fulfilled' && cn.value) result.cn = cn.value;
    // 只缓存有内容的查询，避免把失败结果永久缓存
    if (result.cn || result.defs.length) {
      cacheAll[key] = result;
      const keys = Object.keys(cacheAll);
      if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete cacheAll[k]);
      Z.store.set('wordCache', cacheAll);
    }
    return result;
  }

  Z.Translate = {
    targetFor, targetFromSetting, pairFor, translateBlocks, freeTranslateOne, lookupWord, myMemory
  };
})(window.ZY);
