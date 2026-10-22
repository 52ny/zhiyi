/* 知忆 · 翻译与词典 */
(function (Z) {
  const memCache = new Map();
  const MAX_CACHE = 500;

  function cacheGet(key) {
    if (memCache.has(key)) return memCache.get(key);
    const all = Z.store.get('trCache', {});
    if (all[key]) { memCache.set(key, all[key]); return all[key]; }
    return null;
  }
  function cacheSet(key, val) {
    memCache.set(key, val);
    if (memCache.size > MAX_CACHE) memCache.delete(memCache.keys().next().value);
    const all = Z.store.get('trCache', {});
    all[key] = val;
    const keys = Object.keys(all);
    if (keys.length > MAX_CACHE) keys.slice(0, keys.length - MAX_CACHE).forEach((k) => delete all[k]);
    Z.store.set('trCache', all);
  }

  function targetFor(lang) {
    if (lang === 'zh') return { code: 'en', name: '英语', pair: 'zh-CN|en' };
    if (lang === 'ja') return { code: 'zh', name: '中文', pair: 'ja|zh-CN' };
    return { code: 'zh', name: '中文', pair: 'en|zh-CN' };
  }

  function targetFromSetting(lang) {
    const pref = Z.store.get('translate.target', 'auto');
    if (pref === 'zh') return { code: 'zh', name: '中文', pair: null };
    if (pref === 'en') return { code: 'en', name: '英语', pair: null };
    return targetFor(lang);
  }

  function pairFor(from, to) {
    const a = from === 'zh' ? 'zh-CN' : from === 'ja' ? 'ja' : 'en';
    const b = to === 'zh' ? 'zh-CN' : to === 'en' ? 'en' : to === 'ja' ? 'ja' : 'zh-CN';
    return a + '|' + b;
  }

  async function myMemory(text, pair) {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=' + encodeURIComponent(pair);
    const res = await fetch(url);
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
      const parts = [];
      for (const s of sentences) {
        parts.push(await myMemory(s, pair));
        await Z.sleep(120);
      }
      const val = parts.join(' ');
      cacheSet(key, val);
      return val;
    }
    const val = await myMemory(text, pair);
    cacheSet(key, val);
    return val;
  }

  async function translateBlocks(texts, opts = {}) {
    const from = opts.fromLang || Z.langOf(texts.join(' '));
    const target = opts.to || targetFromSetting(from);
    const to = target.code;
    const out = new Array(texts.length).fill('');

    // 已缓存
    const pending = [];
    texts.forEach((t, i) => {
      const hit = cacheGet('ai:' + from + '>' + to + ':' + t);
      if (hit) out[i] = hit;
      else if (t.trim()) pending.push(i);
    });
    if (!pending.length) return out;

    if (Z.AI.isChat()) {
      try {
        const chunks = [];
        for (let k = 0; k < pending.length; k += 12) chunks.push(pending.slice(k, k + 12));
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
        Z.toast('AI 翻译失败，已切换免费翻译：' + e.message, 'error', 3800);
      }
    }

    // 免费翻译兜底（并发 2）
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
        await Z.sleep(80);
      }
    }
    await Promise.all([worker(), worker()]);
    return out;
  }

  async function freeTranslateOne(text, from) {
    const target = targetFromSetting(from);
    return freeTranslate(text, from, target.code);
  }

  async function lookupWord(word) {
    const w = String(word || '').trim().replace(/[^A-Za-z'-]/g, '');
    if (!w) return null;
    const key = 'word:' + w.toLowerCase();
    const hit = Z.store.get('wordCache', {})[key];
    if (hit) return hit;

    const result = { word: w, phonetic: '', defs: [], cn: '', lang: Z.langOf(w) };
    if (/^[A-Za-z][A-Za-z'-]*$/.test(w)) {
      try {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w));
        if (res.ok) {
          const data = await res.json();
          const entry = data[0] || {};
          result.phonetic = (entry.phonetics || []).map((p) => p.text).find(Boolean) || entry.phonetic || '';
          (entry.meanings || []).slice(0, 3).forEach((m) => {
            (m.definitions || []).slice(0, 2).forEach((d) => {
              result.defs.push({ pos: m.partOfSpeech, def: d.definition, example: d.example || '' });
            });
          });
        }
      } catch (e) {}
    }
    try {
      result.cn = await freeTranslate(w, result.lang === 'zh' ? 'zh' : 'en', 'zh');
    } catch (e) {}
    const cache = Z.store.get('wordCache', {});
    cache[key] = result;
    const keys = Object.keys(cache);
    if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete cache[k]);
    Z.store.set('wordCache', cache);
    return result;
  }

  Z.Translate = {
    targetFor, targetFromSetting, pairFor, translateBlocks, freeTranslateOne, lookupWord, myMemory
  };
})(window.ZY);
