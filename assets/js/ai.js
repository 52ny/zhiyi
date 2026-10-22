/* 知忆 · AI 能力（可选，用户自带 Key） */
(function (Z) {
  const PRESETS = {
    agent: { label: '内置智能体（免下载、免 Key）', baseUrl: 'https://text.pollinations.ai/openai', model: 'openai' },
    online: { label: '在线知识库（免下载、免 Key）', baseUrl: '', model: 'baike+moegirl' },
    local: { label: '本地模型（浏览器内）', baseUrl: '', model: 'onnx-community/Qwen2.5-0.5B-Instruct' },
    deepseek: { label: 'DeepSeek（需自己的 Key）', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { label: 'OpenAI（需自己的 Key）', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    custom: { label: '自定义兼容接口', baseUrl: '', model: '' }
  };

  function cfg() {
    const c = Z.store.get('ai', {});
    const provider = c.provider || 'agent';
    const preset = PRESETS[provider] || PRESETS.agent;
    return {
      provider,
      baseUrl: c.baseUrl || preset.baseUrl,
      model: c.model || preset.model,
      apiKey: c.apiKey || '',
      temperature: c.temperature == null ? 0.4 : c.temperature
    };
  }

  function save(patch) {
    const next = Object.assign(cfg(), patch);
    Z.store.set('ai', next);
    return next;
  }

  function isAgent() { return cfg().provider === 'agent'; }
  function isLocal() { return cfg().provider === 'local'; }
  function isOnline() { return cfg().provider === 'online'; }

  function isReady() {
    if (isAgent() || isOnline()) return true;
    if (isLocal()) return !!(Z.LocalAI && Z.LocalAI.ready);
    const c = cfg();
    return !!(c.apiKey && c.baseUrl && c.model);
  }

  /** 是否能做自由对话（在线知识库只能拆解知识点） */
  function isChat() {
    if (isOnline()) return false;
    return isReady();
  }

  function endpoint() {
    const base = cfg().baseUrl.trim().replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(base)) return base;
    return base + '/chat/completions';
  }

  function parseJSON(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = s.search(/[[{]/);
    if (start < 0) throw new Error('AI 返回内容不是 JSON');
    let depth = 0, inStr = false, esc = false, end = -1;
    const open = s[start];
    const close = open === '{' ? '}' : ']';
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error('AI 返回的 JSON 不完整');
    return JSON.parse(s.slice(start, end));
  }

  async function agentChat(messages, opts = {}) {
    const c = cfg();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || 90000);
    try {
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: c.model || 'openai',
          messages,
          temperature: opts.temperature == null ? 0.5 : opts.temperature,
          max_tokens: opts.maxTokens || 2000,
          reasoning_effort: 'low',
          referrer: 'zhiyi'
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error('内置智能体暂时不可用（' + res.status + '）');
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      if (!text.trim()) throw new Error('内置智能体没有返回内容');
      return text;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('内置智能体响应超时');
      if (/Failed to fetch|NetworkError/i.test(e.message)) throw new Error('无法连接内置智能体（网络限制），可改用在线知识库或自己的 Key');
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function chat(messages, opts = {}) {
    const c = cfg();
    if (isAgent()) return agentChat(messages, opts);
    if (isOnline()) throw new Error('当前是「在线知识库」模式，只支持知识点拆解；翻译、出题请切换内置智能体或本地/云端接口');
    if (!isReady()) throw new Error(isLocal() ? '本地模型尚未加载：请到「设置 → AI 增强」点“加载模型”' : '尚未配置 AI：请到「设置 → AI 增强」填写 API Key');
    if (isLocal()) {
      const msgs = opts.json
        ? [{ role: 'system', content: '你只输出严格 JSON，不要输出解释、不要用 Markdown 代码块。' }, ...messages]
        : messages;
      return Z.LocalAI.chat(msgs, { maxTokens: opts.maxTokens || 900, temperature: opts.temperature == null ? c.temperature : opts.temperature });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || 60000);
    try {
      const res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
        body: JSON.stringify({
          model: c.model,
          messages,
          temperature: opts.temperature == null ? c.temperature : opts.temperature,
          max_tokens: opts.maxTokens || 2200,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {})
        }),
        signal: controller.signal
      });
      if (!res.ok) {
        let msg = `请求失败 (${res.status})`;
        try { const j = await res.json(); msg = j.error?.message || j.message || msg; } catch (e) {}
        throw new Error(msg);
      }
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      return text;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI 请求超时，请稍后重试');
      if (/Failed to fetch|NetworkError|load failed/i.test(e.message)) {
        throw new Error('无法连接 AI 接口（可能是网络或跨域限制），可换用自定义兼容接口');
      }
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function test() {
    if (isOnline()) {
      const d = await Z.WebKB.baike('勾股定理');
      return '在线知识库可用（' + d.source + '）';
    }
    const txt = await chat([
      { role: 'system', content: '你是测试助手，只回复两个字：正常' },
      { role: 'user', content: '请回复：正常' }
    ], { maxTokens: 20, temperature: 0 });
    return txt.trim();
  }
  async function translate(texts, from, to) {
    const chunks = [];
    let batch = [];
    let len = 0;
    texts.forEach((t, i) => {
      if (len + t.length > 2600 && batch.length) { chunks.push(batch); batch = []; len = 0; }
      batch.push({ i, t });
      len += t.length;
    });
    if (batch.length) chunks.push(batch);

    const out = new Array(texts.length).fill('');
    for (const chunk of chunks) {
      const payload = chunk.map((x) => `[${x.i}] ${x.t}`).join('\n');
      const raw = await chat([
        { role: 'system', content: `你是专业翻译。将用户提供的每一段编号文本从${from || '原文语言'}翻译成${to}。保持编号，逐段输出，每段格式为「[编号] 译文」，不要合并、不要解释、不要遗漏。术语准确，语气自然。` },
        { role: 'user', content: payload }
      ], { temperature: 0.2, maxTokens: 3000 });
      raw.split(/\n+/).forEach((line) => {
        const m = line.match(/^\s*\[(\d+)\]\s*(.+)$/);
        if (m) {
          const idx = Number(m[1]);
          if (idx >= 0 && idx < out.length) out[idx] = m[2].trim();
        }
      });
      // 兜底：若模型未按编号输出，则按行顺序填充
      if (out.filter(Boolean).length === 0) {
        const lines = raw.split(/\n+/).map((x) => x.replace(/^\s*\[?\d+\]?\s*/, '').trim()).filter(Boolean);
        chunk.forEach((x, k) => { if (lines[k]) out[x.i] = lines[k]; });
      }
    }
    return out;
  }

  async function explain(concept, subject, extra) {
    if (isOnline()) {
      if (!Z.WebKB) throw new Error('在线知识库未加载');
      const sub = !subject || subject === '自动' ? '综合' : subject;
      return Z.WebKB.explain(concept, sub);
    }
    try {
      return await explainByChat(concept, subject, extra);
    } catch (e) {
      // 智能体返回被截断时，重试一次更紧凑的输出
      if (isAgent()) {
        try {
          return await explainByChat(concept, subject, extra, true);
        } catch (e2) {
          if (Z.WebKB) {
            Z.toast('智能体暂不可用，已改用在线知识库', 'info', 3600);
            const sub = !subject || subject === '自动' ? '综合' : subject;
            return Z.WebKB.explain(concept, sub);
          }
          throw e2;
        }
      }
      throw e;
    }
  }

  async function explainByChat(concept, subject, extra, compact) {
    const raw = await chat([
      { role: 'system', content: '你是一位善于把复杂概念讲透的老师。请用中文输出严格 JSON，不要输出 JSON 以外的内容。' },
      { role: 'user', content: `请解释知识点「${concept}」${subject ? '（学科：' + subject + '）' : ''}。
${extra ? '补充信息：' + extra : ''}
${compact ? '本次为精简输出：points/conditions/mistakes/variants/extensions/quiz 每项最多 2 条，句子尽量短。' : ''}
要求：
- formula 必须写出可用的具体式子（符号、单位、适用形式），不要写「核心公式」「定义式」这类占位词；确实无公式时才留空数组。
- quiz 每题的 hint 要给可操作的提示（先想什么、用哪个条件），a 要给出完整答案。
- variants 的 hint 必须写出第一步解题动作。
- extensions 要落到具体结论或应用，不要泛泛而谈。
输出 JSON 结构：
{
 "essence": "一句话本质（不超过40字，抓住核心）",
 "definition": "严谨但不堆砌术语的定义（80-150字）",
 "intuition": "生活化类比或直观解释（80-150字）",
 "points": ["关键要点1", "关键要点2", "关键要点3"],
 "formula": ["F = ma（F 牛顿，m 千克，a 米每二次方秒）"],
 "conditions": ["适用条件/前提1", "条件2"],
 "mistakes": [{"wrong":"常见错误理解","right":"正确理解"}],
 "variants": [{"q":"变式题或变形问法","hint":"第一步：……"}],
 "extensions": ["具体拓展结论或应用1", "拓展2"],
 "relations": [{"name":"相关概念","why":"关系说明"}],
 "quiz": [{"q":"自测问题","hint":"思路提示","a":"完整参考答案"}]
}` }], { json: true, temperature: compact ? 0.3 : 0.5, maxTokens: compact ? 1400 : 3000 });
    return parseJSON(raw);
  }

  async function feynman(concept, explanation) {
    const raw = await chat([
      { role: 'system', content: '你是一位费曼学习法教练。请用中文输出严格 JSON。' },
      { role: 'user', content: `学习者在用自己的话解释「${concept}」：
"""
${explanation}
"""
请评估这段解释，输出 JSON：
{"score": 0-100的整数, "kept": ["讲对的地方"], "gaps": ["含糊或缺失的地方"], "fix": ["具体改进建议"], "question": "追问一个问题，检验是否真正理解"}
` }], { json: true, temperature: 0.4, maxTokens: 1000 });
    return parseJSON(raw);
  }

  async function mindmap(text, title) {
    const raw = await chat([
      { role: 'system', content: '你是知识结构化专家。把材料整理成思维导图树，用中文输出严格 JSON。' },
      { role: 'user', content: `材料标题：${title}
材料内容：
${text.slice(0, 6000)}

输出 JSON：{"root":"中心主题（不超过14字）","children":[{"text":"一级分支（不超过18字）","children":[{"text":"二级节点（不超过24字）","children":[]}]}]}
要求：2-5 个一级分支；每个分支 2-5 个二级节点；保留关键术语与因果/分类关系；总节点不超过 45 个。` }], { json: true, temperature: 0.3, maxTokens: 2000 });
    return parseJSON(raw);
  }

  async function cards(text, count = 8) {
    const raw = await chat([
      { role: 'system', content: '你是记忆卡片设计师。请用中文输出严格 JSON。' },
      { role: 'user', content: `根据以下材料生成 ${count} 张主动回忆卡片（问答式，问题具体、答案简洁）：
${text.slice(0, 5000)}
输出：{"cards":[{"front":"问题","back":"答案","tag":"所属主题"}]}` }], { json: true, temperature: 0.4, maxTokens: 1800 });
    return parseJSON(raw);
  }

  Z.AI = {
    PRESETS, cfg, save, isReady, isChat, isAgent, isLocal, isOnline, chat, test, translate, explain, feynman, mindmap, cards, parseJSON,
    label() {
      const c = cfg();
      if (c.provider === 'agent') return '内置智能体 · GPT-OSS 20B';
      if (c.provider === 'online') return '在线知识库 · 百度百科/萌娘百科';
      if (c.provider === 'local') {
        const s = Z.LocalAI?.snapshot?.();
        return s?.ready ? '浏览器内 · ' + (s.model?.name || '本地模型') : '浏览器内 · 未加载';
      }
      if (c.provider === 'custom') return c.model || '自定义 AI';
      return PRESETS[c.provider].label + ' · ' + c.model;
    }
  };
})(window.ZY);
