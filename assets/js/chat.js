/* 知忆 · 通用 AI 助手（内置智能体，免下载、免 Key） */
(function (Z) {
  const SYSTEM = '你是「知忆」的 AI 学习助手，面向大众用户。回答要准确、简洁、可执行：先给结论，再给必要步骤或例子；默认控制在 300 字以内，用户要求详细时再展开。不确定时直说。涉及公式时写出完整式子并标注符号含义。使用简体中文，除非用户要求其他语言。';
  const CHIPS = [
    { label: '解释一个概念', text: '请用初学者能懂的话解释：' },
    { label: '翻译一段', text: '请翻译下面这段内容，保持原意、语气自然：\n' },
    { label: '出 5 道自测题', text: '请就以下主题出 5 道自测题，先给题目，最后统一给答案与解析：\n' },
    { label: '制定复习计划', text: '请帮我制定一个 3 天复习计划，包含每天的任务与自测方式，主题是：' },
    { label: '润色文字', text: '请润色下面这段文字，保持原意，让表达更清晰：\n' }
  ];

  let pending = null;
  let ui = null;

  function loadHistory() {
    const list = Z.store.get('chat.history', []);
    return Array.isArray(list) ? list.slice(-40) : [];
  }
  function saveHistory(list) {
    Z.store.set('chat.history', list.slice(-40));
  }

  function mount(container, docs) {
    const history = loadHistory();
    const ctxId = Z.store.get('chat.doc', '');
    ui = { container, docs: docs || [], msgs: history, busy: false, ctxId };
    container.innerHTML = `<div class="chat-page">
      <div class="chat-head">
        <div>
          <span class="eyebrow">AI ASSISTANT</span>
          <h1>问 AI</h1>
          <p>讲解、翻译、出题、写作、计划，都可以直接问。</p>
        </div>
        <div class="chat-head-actions">
          <select id="chat-doc" title="附带一份资料作为上下文">
            <option value="">不附加资料</option>
            ${(docs || []).map((d) => `<option value="${d.id}" ${ctxId === d.id ? 'selected' : ''}>${Z.esc(Z.truncate(d.title, 24))}</option>`).join('')}
          </select>
          <button class="btn ghost small" id="chat-clear">清空对话</button>
        </div>
      </div>
      <div class="chat-log" id="chat-log"></div>
      <div class="chat-chips">
        ${CHIPS.map((c) => `<button type="button" data-chip="${Z.esc(c.label)}">${Z.esc(c.label)}</button>`).join('')}
      </div>
      <div class="chat-compose">
        <textarea id="chat-input" rows="2" placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"></textarea>
        <button class="btn primary" id="chat-send">${Z.icon('sparkle')}发送</button>
      </div>
      <div class="chat-tip">回答由 AI 生成，重要结论请自行核对。</div>
    </div>`;

    Z.hydrateIcons(container);
    renderLog();
    bind();

    if (pending) {
      const p = pending;
      pending = null;
      if (p.docId) {
        ui.ctxId = p.docId;
        const sel = Z.$('#chat-doc', container);
        if (sel) sel.value = p.docId;
        Z.store.set('chat.doc', p.docId);
      }
      if (p.text) send(p.text);
    }
  }

  function renderLog() {
    const log = Z.$('#chat-log', ui.container);
    if (!log) return;
    if (!ui.msgs.length) {
      log.innerHTML = `<div class="chat-empty">
        <span class="chat-empty-ico">${Z.icon('sparkle')}</span>
        <strong>有什么想弄明白的？</strong>
        <span>可以问知识点、要例子、让它出题，或附上一份资料后说“总结一下”。</span>
      </div>`;
      return;
    }
    log.innerHTML = ui.msgs.map((m) => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">
      ${m.role === 'user' ? '' : `<span class="msg-avatar">知</span>`}
      <div class="msg-body">${format(m.content)}</div>
    </div>`).join('') + (ui.busy ? `<div class="msg ai"><span class="msg-avatar">知</span><div class="msg-body"><span class="spinner small"></span> 正在思考…</div></div>` : '');
    log.scrollTop = log.scrollHeight;
  }

  function format(text) {
    let s = Z.esc(text || '');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\s*[-*]\s+(.+)$/gm, '• $1')
      .replace(/^\s*(\d+)[.、]\s+(.+)$/gm, '$1. $2');
    return s.replace(/\n/g, '<br>');
  }

  function bind() {
    const root = ui.container;
    const input = Z.$('#chat-input', root);
    Z.$('#chat-send', root).addEventListener('click', () => {
      const t = input.value.trim();
      if (t) send(t);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const t = input.value.trim();
        if (t) send(t);
      }
    });
    Z.$$('[data-chip]', root).forEach((b) => b.addEventListener('click', () => {
      const chip = CHIPS.find((c) => c.label === b.dataset.chip);
      input.value = chip ? chip.text : '';
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }));
    Z.$('#chat-doc', root).addEventListener('change', (e) => {
      ui.ctxId = e.target.value;
      Z.store.set('chat.doc', ui.ctxId);
    });
    Z.$('#chat-clear', root).addEventListener('click', async () => {
      if (!ui.msgs.length) return;
      if (!(await Z.confirm('清空当前对话记录？'))) return;
      ui.msgs = [];
      saveHistory([]);
      renderLog();
    });
  }

  function contextText() {
    if (!ui.ctxId) return '';
    const doc = ui.docs.find((d) => d.id === ui.ctxId);
    if (!doc) return '';
    const text = (doc.blocks || []).map((b) => b.text).join('\n').slice(0, 6000);
    return `\n\n[参考资料：${doc.title}]\n${text}`;
  }

  async function send(text) {
    if (ui.busy) return;
    const input = Z.$('#chat-input', ui.container);
    if (input) input.value = '';
    ui.msgs.push({ role: 'user', content: text });
    ui.busy = true;
    renderLog();
    saveHistory(ui.msgs);
    try {
      if (!Z.AI.ensureAgent()) throw new Error('AI 暂不可用：请在设置中检查内置智能体或填写接口 Key');
      const ctx = contextText();
      const history = ui.msgs.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const payload = ctx ? history.concat([{ role: 'system', content: '以下是用户当前打开的资料，回答时优先参考：' + ctx }]) : history;
      const reply = await Z.AI.chat([{ role: 'system', content: SYSTEM }, ...payload], { temperature: 0.4, maxTokens: 900 });
      ui.msgs.push({ role: 'assistant', content: reply.trim() });
    } catch (e) {
      ui.msgs.push({ role: 'assistant', content: '抱歉，没能回答：' + e.message });
    } finally {
      ui.busy = false;
      saveHistory(ui.msgs);
      renderLog();
    }
  }

  function prefill(text, docId) {
    pending = { text: text || '', docId: docId || '' };
    if (location.hash === '#/chat') {
      const p = pending;
      pending = null;
      if (p.docId) {
        ui.ctxId = p.docId;
        const sel = Z.$('#chat-doc');
        if (sel) sel.value = p.docId;
        Z.store.set('chat.doc', p.docId);
      }
      if (p.text && ui && !ui.busy) send(p.text);
    } else {
      location.hash = '#/chat';
    }
  }

  Z.ChatPage = { mount, prefill };
})(window.ZY);
