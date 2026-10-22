/* 知忆 · 在线知识库（百度百科 + 萌娘百科，免下载、免 Key） */
(function (Z) {
  const cbQueue = {};
  let cbSeq = 0;

  function jsonp(url, timeout = 9000) {
    return new Promise((resolve, reject) => {
      const name = '__zy_cb_' + Date.now() + '_' + (++cbSeq);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('请求超时')), timeout);
      function finish(err, data) {
        clearTimeout(timer);
        delete window[name];
        delete cbQueue[name];
        script.remove();
        if (err) reject(err); else resolve(data);
      }
      cbQueue[name] = (data) => finish(null, data);
      window[name] = cbQueue[name];
      script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + name;
      script.onerror = () => finish(new Error('网络不可用'));
      document.head.appendChild(script);
    });
  }

  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/<sup[\s\S]*?<\/sup>/gi, '')
      .replace(/<a[\s\S]*?<\/a>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sentences(text) {
    return String(text || '')
      .split(/(?<=[。！？；!?;])|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 6);
  }

  function cardMap(card) {
    const map = {};
    (card || []).forEach((c) => {
      const k = clean(c.name || c.key);
      const v = clean((c.value || []).join('、'));
      if (k && v) map[k] = v;
    });
    return map;
  }

  async function baike(term) {
    const url = 'https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=' + encodeURIComponent(term);
    const data = await jsonp(url);
    if (!data || !data.key) throw new Error('百度百科没有收录');
    const raw = String(data.url || '').trim();
    const link = /^https?:\/\//i.test(raw)
      ? raw.replace(/^http:/i, 'https:')
      : raw ? 'https://baike.baidu.com' + raw : 'https://baike.baidu.com/item/' + encodeURIComponent(term);
    return {
      title: clean(data.title || data.key),
      abstract: clean(data.abstract || ''),
      card: cardMap(data.card),
      url: link,
      source: '百度百科'
    };
  }

  async function moegirl(term) {
    const api = 'https://zh.moegirl.org.cn/api.php?action=query&format=json&generator=search&gsrlimit=3&prop=extracts&explaintext=1&exlimit=3&origin=*&gsrsearch=' + encodeURIComponent(term);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res;
    try {
      res = await fetch(api, { credentials: 'omit', signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error('萌娘百科请求失败');
    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    if (!pages.length) throw new Error('萌娘百科没有收录');
    pages.sort((a, b) => (a.index || 9) - (b.index || 9));
    const best = pages[0];
    return {
      title: clean(best.title),
      text: clean(best.extract || ''),
      related: pages.slice(1).map((p) => clean(p.title)),
      url: 'https://zh.moegirl.org.cn/' + encodeURIComponent(best.title),
      source: '萌娘百科'
    };
  }

  function splitList(v) {
    return String(v || '').split(/[；;、\n]/).map((x) => x.trim()).filter(Boolean);
  }

  function pickFormulas(abstract, card) {
    const out = [];
    splitList(card['表达式'] || card['公式'] || card['数学表达式']).forEach((x) => out.push(x));
    const re = /[A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5₂³²⁰¹⁴⁵⁶⁷⁸⁹₀₁]*(?:\s*[·×+\-]\s*[A-Za-z0-9\u4e00-\u9fa5₀₁₂³²⁰¹⁴⁵⁶⁷⁸⁹]+)*\s*=\s*[^，。；\n]{2,40}/g;
    (abstract.match(re) || []).forEach((x) => {
      const s = x.trim();
      if (s.length >= 4 && !out.some((o) => o.includes(s) || s.includes(o))) out.push(s);
    });
    return out.slice(0, 5);
  }

  function compose(term, subject, data, extra) {
    const abstract = data.abstract || (extra && extra.text) || '';
    const sents = sentences(abstract);
    const card = data.card || {};
    const formula = pickFormulas(abstract, card);
    const conds = splitList(card['限制条件'] || card['适用条件'] || card['前提'] || '');
    if (!conds.length) {
      sents.filter((s) => /条件|前提|当|若|在.{0,12}中/.test(s)).slice(0, 3).forEach((s) => conds.push(s));
    }

    const definition = (sents.slice(0, 4).join('') || abstract || '').slice(0, 420);
    const essence = (sents[0] || definition || term).slice(0, 80);

    let intuition = sents.find((s) => /相当于|就像|好比|例如|如.*一样|可以看?作/.test(s)) || '';
    if (!intuition) {
      const field = card['适用领域'] || card['应用学科'] || card['学科'];
      intuition = field ? `它主要用于${field}，遇到相关问题时可以优先检查是否满足其前提条件。` : (sents[1] || '');
    }

    const points = Object.entries(card)
      .filter(([k]) => !['中文名', '外文名', '别名', '展开'].includes(k))
      .slice(0, 6)
      .map(([k, v]) => `${k}：${v}`);
    sents.slice(0, 3).forEach((s) => { if (points.length < 5) points.push(s); });

    const mistakes = [];
    if (conds.length) {
      mistakes.push({ wrong: `忽略前提直接套用「${term}」`, right: `先确认成立条件：${conds.join('；')}` });
    }
    const warn = sents.find((s) => /注意|不能|并不是|不等于|区别于/.test(s));
    if (warn) mistakes.push({ wrong: '把相近概念或特殊情况混为一谈', right: warn });
    if (mistakes.length < 2) mistakes.push({ wrong: '只背结论，不记适用范围', right: '把“对象—条件—结论”三件事一起记，遇到新情境先核对条件。' });

    const variants = [];
    if (formula.length) {
      variants.push({ q: `在 ${formula[0]} 中，已知其余量，求剩下的量。`, hint: `先写出 ${formula[0]}，再把已知量代入并解方程。` });
    }
    variants.push({ q: `「${term}」成立需要哪些条件？去掉其中一条会怎样？`, hint: `逐条对照：${conds[0] || '定义中的前提'}，再去掉它找一个反例。` });
    const cloze = sents.find((s) => s.includes(term) && s.length > 12 && s.length < 120);
    if (cloze) variants.push({ q: `填空：${cloze.replace(term, '____')}`, hint: `答案就是「${term}」，注意它在句中的定义位置。` });
    variants.push({ q: `用一个生活或工程中的例子说明「${term}」。`, hint: '按“对象—条件—结论”三要素组织例子，避免只复述定义。' });

    const extensions = [];
    if (card['适用领域']) extensions.push(`应用领域：${card['适用领域']}`);
    if (card['应用学科']) extensions.push(`所属学科：${card['应用学科']}`);
    if (card['提出者']) extensions.push(`提出/代表人物：${card['提出者']}`);
    if (card['中国记载著作']) extensions.push(`相关著作：${card['中国记载著作']}`);
    if (formula.length > 1) extensions.push(`相关表达式：${formula.slice(1, 3).join('；')}`);
    if (extra?.related?.length) extensions.push(`延伸阅读：${extra.related.slice(0, 3).join('、')}`);
    if (!extensions.length) extensions.push('把该概念与相邻知识点做一张对比表：对象、条件、结论各写一行。');

    const relations = [];
    if (extra?.related?.length) {
      extra.related.slice(0, 3).forEach((name) => relations.push({ name, why: '检索到的相邻条目，可用于横向对比' }));
    }
    if (card['别名']) relations.push({ name: card['别名'].split(/[、,，]/)[0], why: '同一概念的其他名称，避免换说法就不认识' });

    const quiz = [
      { q: `「${term}」的定义是什么？`, hint: '先想它描述的对象，再说核心结论。', a: definition || '资料中暂无完整定义。' },
      { q: `写出「${term}」的表达式或判定关系。`, hint: '回忆定义中的等式或不等式。', a: formula.length ? formula.join('；') : '该概念以文字定义为主，没有统一公式，重点记判定条件。' },
      { q: `「${term}」的适用条件有哪些？`, hint: '注意“仅当、在…条件下”这类限定。', a: conds.length ? conds.join('；') : '见定义中的前提说明。' }
    ];

    return {
      subject: subject || '综合',
      name: data.title || term,
      essence,
      definition,
      intuition,
      points: points.slice(0, 6),
      formula,
      conditions: conds.length ? conds : ['以原文定义中的前提为准'],
      mistakes,
      variants,
      extensions: extensions.slice(0, 5),
      relations,
      quiz,
      source: data.source,
      url: data.url,
      extraUrl: extra?.url || ''
    };
  }

  async function explain(term, subject) {
    const [b, m] = await Promise.allSettled([baike(term), moegirl(term)]);
    const base = b.status === 'fulfilled' ? b.value : null;
    const extra = m.status === 'fulfilled' ? m.value : null;
    if (!base && !extra) {
      const why = [b, m].filter((x) => x.status === 'rejected').map((x) => x.reason?.message || '失败').join('；');
      throw new Error('在线知识库未找到「' + term + '」' + (why ? '（' + why + '）' : ''));
    }
    const primary = base || { title: extra.title, abstract: extra.text.slice(0, 800), card: {}, url: extra.url, source: extra.source };
    if (!primary.abstract && extra) primary.abstract = extra.text.slice(0, 800);
    return compose(term, subject, primary, extra);
  }

  Z.WebKB = { explain, baike, moegirl, compose };
})(window.ZY);
