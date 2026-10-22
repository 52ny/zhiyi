/* 知忆 · 路由与页面 */
(function (Z) {
  let docs = [];
  let cleanup = null;
  let currentDocId = null;
  let homeFilter = { q: '', type: 'all' };
  let dragDepth = 0;

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = (path || 'home').split('/');
    return { name: parts[0] || 'home', id: parts[1] || '', query: new URLSearchParams(qs || '') };
  }

  async function loadDocs() {
    docs = await Z.DB.allDocs();
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const s = Z.Review.stats(docs);
    const badge = Z.$('#nav-due');
    if (badge) {
      badge.textContent = s.due > 99 ? '99+' : s.due;
      badge.hidden = !s.due;
    }
    const mini = Z.$('#streak-mini');
    if (mini) {
      const streak = Z.Review.streak();
      mini.innerHTML = `<span class="streak-dot ${streak ? 'hot' : ''}"></span><span>${streak ? streak + ' 天连续复习' : '今天还未复习'}</span>`;
    }
    return docs;
  }

  const PALETTES = [
    { id: 'ink', name: '墨绿', c: '#176b5b' },
    { id: 'mist', name: '雾蓝', c: '#3a7391' },
    { id: 'clay', name: '陶土', c: '#a1613f' },
    { id: 'lilac', name: '藕紫', c: '#7a6b9e' },
    { id: 'stone', name: '素墨', c: '#5b6660' }
  ];

  function applyTheme() {
    const t = Z.store.get('theme', 'paper');
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.palette = Z.store.get('palette', 'ink');
    const btn = Z.$('#theme-toggle');
    if (btn) btn.innerHTML = Z.icon(t === 'dark' ? 'sun' : 'moon');
  }

  function setTheme(t) { Z.store.set('theme', t); applyTheme(); }
  function setPalette(p) { Z.store.set('palette', p); applyTheme(); }

  function localStatusText(snap) {
    const s = snap || Z.LocalAI.snapshot();
    if (s.error) return s.error;
    if (s.loading) return s.status || '加载中…';
    if (s.ready) return (s.device === 'webgpu' ? 'GPU 加速' : 'CPU 推理') + ' · ' + (s.model?.name || '模型') + ' 已就绪';
    return '未加载 · 首次需下载模型';
  }

  function paintLocal(snap) {
    const fill = Z.$('#local-fill');
    if (!fill) return;
    fill.style.width = (snap.ready ? 100 : snap.progress || 0) + '%';
    const st = Z.$('#local-status');
    if (st) st.textContent = localStatusText(snap);
    const btn = Z.$('#local-load');
    if (btn) {
      btn.disabled = !!snap.loading;
      btn.textContent = snap.loading ? '加载中…' : snap.ready ? '重新加载' : '加载模型';
    }
    const ai = Z.$('#ai-status');
    if (ai && Z.AI.isLocal()) ai.textContent = snap.ready ? '可用 · ' + Z.AI.label() : '未就绪';
  }

  /* ---------- AI 助手（默认内置智能体，无需下载） ---------- */
  function updateAiUI(snap) {
    const s = snap || Z.LocalAI.snapshot();
    const cfg = Z.AI.cfg();
    const ready = Z.AI.isReady();
    const online = cfg.provider === 'online';
    const localPending = cfg.provider === 'local' && !s.ready;
    const btn = Z.$('#rail-ai');
    const label = Z.$('#rail-ai-label');
    const fill = Z.$('#rail-ai-fill');
    if (btn && label) {
      btn.classList.toggle('loading', !!s.loading && localPending);
      btn.classList.toggle('ready', ready);
      btn.disabled = !!s.loading && localPending;
      label.textContent = localPending
        ? (s.loading ? '下载中 ' + (s.progress || 0) + '%' : s.error ? '下载失败 · 重试' : '下载离线 AI')
        : online ? '在线知识库' : ready ? 'AI 已就绪' : '启用 AI';
      if (fill) fill.style.width = (ready ? 100 : s.progress || 0) + '%';
      btn.title = ready
        ? 'AI 已就绪，点击去知识工坊'
        : localPending ? (s.status || '下载中…') : '启用内置智能体（免下载、免 Key）';
    }
    const hero = Z.$('#home-ai');
    if (hero) {
      hero.textContent = ready ? 'AI 已就绪' : s.loading ? '下载中 ' + (s.progress || 0) + '%' : '启用 AI 助手';
      hero.disabled = !!s.loading && localPending;
    }
  }

  async function enableAI() {
    const s = Z.LocalAI.snapshot();
    if (s.loading && Z.AI.cfg().provider === 'local') { openAiModal(); return; }
    if (Z.AI.isReady()) { location.hash = '#/lab'; return; }
    openAiModal();
  }

  function openAiModal() {
    const current = Z.AI.label();
    const m = Z.modal({
      title: 'AI 助手',
      sub: '默认使用内置智能体：免下载、免 Key，打开即用',
      body: `<div class="ai-dl">
        <div class="ai-dl-top">
          <span class="ai-dl-ico">${Z.icon('sparkle')}</span>
          <div>
            <strong>内置智能体 · GPT-OSS 20B</strong>
            <span>由公共推理服务提供 · 不需要下载、不需要 Key</span>
          </div>
        </div>
        <div class="ai-dl-status" id="ai-dl-status">当前：${Z.esc(current)}</div>
        <div class="ai-dl-actions">
          <button class="btn primary small" id="ai-use-agent">立即使用</button>
          <button class="btn ghost small" id="ai-test-btn">测试连接</button>
          <button class="btn ghost small" id="ai-use-online">在线知识库</button>
          <button class="btn ghost small" id="ai-download">下载离线模型</button>
        </div>
        <div class="ai-dl-bar" id="ai-dl-bar" hidden><i id="ai-dl-fill"></i></div>
        <div class="ai-dl-actions" id="ai-dl-local-actions" hidden>
          <button class="btn ghost small" id="ai-dl-retry" hidden>重试下载</button>
          <button class="btn primary small" id="ai-dl-go" hidden>去知识工坊</button>
        </div>
        <details class="ai-dl-adv">
          <summary>下载离线模型失败？换模型源</summary>
          <div class="local-row">
            <input class="input" id="ai-dl-mirror" value="${Z.esc(Z.LocalAI.mirrorHost())}" placeholder="https://hf-mirror.com">
            <button class="btn ghost small" id="ai-dl-mirror-save">保存并重试</button>
          </div>
          <p class="set-hint">离线模型约 480MB，仅在需要断网使用时才下载；日常用内置智能体即可。</p>
        </details>
      </div>`,
      footer: null
    });
    const st = (t) => { const el = Z.$('#ai-dl-status', m.root); if (el) el.textContent = t; };
    const paint = (snap) => {
      const fill = Z.$('#ai-dl-fill', m.root);
      const bar = Z.$('#ai-dl-bar', m.root);
      const re = Z.$('#ai-dl-retry', m.root);
      const go = Z.$('#ai-dl-go', m.root);
      const act = Z.$('#ai-dl-local-actions', m.root);
      if (!fill) return;
      if (snap.loading || snap.ready || (snap.progress > 0 && Z.AI.cfg().provider === 'local')) {
        bar.hidden = false; act.hidden = false;
      }
      fill.style.width = (snap.ready ? 100 : snap.progress || 0) + '%';
      fill.classList.toggle('done', !!snap.ready);
      if (Z.AI.cfg().provider !== 'local') return;
      st(snap.ready ? '离线模型已就绪' : (snap.status || (snap.loading ? '下载中…' : '未加载')));
      if (re) re.hidden = !(snap.error && !snap.loading);
      if (go) go.hidden = !snap.ready;
    };
    const un = Z.LocalAI.subscribe(paint);
    paint(Z.LocalAI.snapshot());
    const origClose = m.close;
    m.close = () => { un(); origClose(); };

    Z.$('#ai-use-agent', m.root).onclick = () => {
      Z.AI.save({ provider: 'agent', model: 'openai' });
      m.close();
      updateAiUI();
      Z.toast('已启用内置智能体', 'ok');
      location.hash = '#/lab';
    };
    Z.$('#ai-test-btn', m.root).onclick = async () => {
      st('测试中…');
      try {
        const r = await Z.AI.test();
        st('连接正常：' + r);
        Z.toast('AI 可用', 'ok');
      } catch (e) {
        st('失败：' + e.message);
      }
    };
    Z.$('#ai-use-online', m.root).onclick = () => {
      Z.AI.save({ provider: 'online' });
      m.close();
      updateAiUI();
      Z.toast('已切到在线知识库，免下载', 'ok');
      route();
    };
    Z.$('#ai-download', m.root).onclick = async () => {
      Z.AI.save({ provider: 'local', model: 'onnx-community/Qwen2.5-0.5B-Instruct' });
      Z.$('#ai-dl-bar', m.root).hidden = false;
      Z.$('#ai-dl-local-actions', m.root).hidden = false;
      st('开始下载…');
      paint(Z.LocalAI.snapshot());
      await Z.LocalAI.load('onnx-community/Qwen2.5-0.5B-Instruct');
      updateAiUI();
    };
    Z.$('#ai-dl-retry', m.root).onclick = () => Z.LocalAI.load(Z.LocalAI.snapshot().modelId);
    Z.$('#ai-dl-go', m.root).onclick = () => { m.close(); location.hash = '#/lab'; };
    Z.$('#ai-dl-mirror-save', m.root).onclick = () => {
      const v = Z.$('#ai-dl-mirror', m.root).value.trim();
      Z.store.set('local.mirror', v || Z.LocalAI.MIRROR);
      Z.toast('模型源已更新，正在重试', 'ok');
      Z.LocalAI.load(Z.LocalAI.snapshot().modelId);
    };
    m.root.addEventListener('click', (e) => {
      if (e.target.closest('.modal-x') || e.target === m.root) m.close();
    });
  }

  function setCrumb(html) { Z.$('#crumb').innerHTML = html; }
  function setTopActions(html) {
    const el = Z.$('#top-actions');
    el.innerHTML = html;
    Z.hydrateIcons(el);
  }
  function navTo(name) {
    Z.$$('#nav .nav-item').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    Z.$('#rail').classList.remove('open');
  }

  async function route() {
    const r = parseRoute();
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    Z.TTS.stop();
    document.body.classList.remove('focus-mode');
    const pop = Z.$('#popover');
    if (pop) pop.hidden = true;
    Z.$('#rail').classList.remove('open');
    await loadDocs();
    const view = Z.$('#view');

    if (r.name === 'doc' && r.id) {
      navTo('');
      const doc = docs.find((d) => d.id === r.id) || await Z.DB.getDoc(r.id);
      if (!doc) { Z.toast('资料不存在或已删除', 'error'); location.hash = '#/home'; return; }
      renderDoc(view, doc, r);
      return;
    }
    if (r.name === 'review') { navTo('review'); renderReview(view); return; }
    if (r.name === 'lab') { navTo('lab'); setCrumb('<span>知识工坊</span>'); setTopActions(''); Z.Lab.mount(view); return; }
    if (r.name === 'settings') { navTo('settings'); setCrumb('<span>设置</span>'); setTopActions(''); renderSettings(view); return; }
    navTo('home');
    renderHome(view);
  }

  async function refresh() {
    await loadDocs();
    await route();
  }

  /* ================= 首页 ================= */
  function renderHome(view) {
    setCrumb('<span>文库</span>');
    setTopActions(`<button class="btn primary small" data-import><span data-ico="upload"></span>导入资料</button>`);
    const s = Z.Review.stats(docs);
    const highlights = docs.reduce((n, d) => n + (d.highlights || []).length, 0);
    const filtered = docs.filter((d) => {
      if (homeFilter.type !== 'all' && d.type !== homeFilter.type) return false;
      if (homeFilter.q && !((d.title + ' ' + (d.blocks || []).slice(0, 4).map((b) => b.text).join(' ')).toLowerCase().includes(homeFilter.q.toLowerCase()))) return false;
      return true;
    });

    view.innerHTML = `<div class="home">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">LOCAL-FIRST · SPACED MEMORY</span>
          <h1>把资料，<em>变成记得住的知识</em>。</h1>
          <p>导入文件即得导图、双语与卡片。全部保存在本机。</p>
          <div class="hero-actions">
            <button class="btn primary" data-import><span data-ico="upload"></span>导入第一份资料</button>
            <button class="btn ghost" id="home-ai" data-download-ai><span data-ico="sparkle"></span>启用 AI 助手</button>
          </div>
          <div class="hero-chips">
            <span>双语对照</span><span>点词朗读</span><span>思维导图</span><span>手绘批注</span><span>主动回忆</span><span>间隔复习</span>
          </div>
        </div>
        <div class="hero-ring">
          <div class="ring-wrap">
            <svg viewBox="0 0 140 140">
              <circle class="ring-track" cx="70" cy="70" r="60" stroke-width="11"/>
              <circle class="ring-fill" cx="70" cy="70" r="60" stroke-width="11" stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 60}" stroke-dashoffset="${2 * Math.PI * 60 * (1 - Math.min(1, s.due / Math.max(1, s.cards)))}" transform="rotate(-90 70 70)"/>
            </svg>
            <div class="ring-center"><strong>${s.due}</strong><span>张到期</span></div>
          </div>
          <div class="ring-caption"><span>今日记忆环</span><em>${s.streak ? s.streak + ' 天连续' : '从今天开始'}</em></div>
          <button class="btn ${s.due ? 'primary' : 'ghost'} small" id="home-review" ${s.due ? '' : 'disabled'}>${s.due ? '开始复习' : '今日已完成'}</button>
        </div>
      </section>

      <section class="stat-row">
        <div class="stat"><strong>${docs.length}</strong><span>份资料</span></div>
        <div class="stat"><strong>${highlights}</strong><span>处高亮</span></div>
        <div class="stat"><strong>${s.cards}</strong><span>张卡片</span></div>
        <div class="stat"><strong>${s.mastered}</strong><span>已掌握</span></div>
        <div class="stat"><strong>${s.streak}</strong><span>连续复习天数</span></div>
      </section>

      <section class="library-head">
        <div><h2>你的文库</h2><p>${docs.length ? '共 ' + docs.length + ' 份资料，按最近打开排序' : '还没有资料'}</p></div>
        <div class="lib-tools">
          <div class="search-box"><span data-ico="search"></span><input id="home-search" placeholder="搜索标题或内容…" value="${Z.esc(homeFilter.q)}"></div>
          <div class="seg">
            <button data-ft="all" class="${homeFilter.type === 'all' ? 'on' : ''}">全部</button>
            <button data-ft="knowledge" class="${homeFilter.type === 'knowledge' ? 'on' : ''}">知识型</button>
            <button data-ft="text" class="${homeFilter.type === 'text' ? 'on' : ''}">课文型</button>
          </div>
        </div>
      </section>

      <section class="doc-grid">
        <button class="doc-add" data-import>
          <span class="add-ico">${Z.icon('plus')}</span>
          <strong>拖入或点击导入</strong>
          <em>PDF · 图片 · DOCX · PPTX · MD · TXT</em>
        </button>
        ${filtered.map((d, i) => docCard(d, i)).join('')}
      </section>
      ${!filtered.length && docs.length ? '<p class="muted center pad">没有匹配的资料，换个关键词试试。</p>' : ''}
    </div>`;

    Z.hydrateIcons(view);
    Z.$$('[data-import]', view).forEach((b) => b.addEventListener('click', openImport));
    Z.$('#home-review', view)?.addEventListener('click', () => {
      Z.Review.startSession(docs);
    });
    Z.$('#home-search', view)?.addEventListener('input', Z.debounce((e) => {
      homeFilter.q = e.target.value;
      renderHome(view);
      const input = Z.$('#home-search');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }, 220));
    view.querySelectorAll('[data-ft]').forEach((b) => b.addEventListener('click', () => {
      homeFilter.type = b.dataset.ft;
      renderHome(view);
    }));
    updateAiUI();
    view.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del-doc]');
      if (del) {
        e.stopPropagation();
        const doc = docs.find((d) => d.id === del.dataset.delDoc);
        if (!doc) return;
        if (!(await Z.confirm(`删除「${doc.title}」及其卡片与批注？`, { danger: true, ok: '删除' }))) return;
        await Z.DB.deleteDoc(doc);
        if (doc.sourceBlobId) await Z.DB.deleteBlob(doc.sourceBlobId);
        Z.toast('已删除', 'ok');
        refresh();
        return;
      }
      const card = e.target.closest('[data-doc]');
      if (card) location.hash = '#/doc/' + card.dataset.doc;
    });
  }

  function docCard(d, i) {
    const cards = d.cards || [];
    const mastered = cards.filter((c) => (c.interval || 0) >= 21).length;
    const pct = cards.length ? Math.round(mastered / cards.length * 100) : 0;
    const typeName = d.type === 'knowledge' ? '知识型' : '课文型';
    const lang = d.lang === 'zh' ? '中文' : d.lang === 'en' ? '英文' : d.lang === 'ja' ? '日文' : d.lang || '';
    return `<article class="doc-card fade-up" style="animation-delay:${Math.min(i * 40, 320)}ms" data-doc="${d.id}" tabindex="0">
      <div class="doc-cover ${d.cover ? 'has-img' : ''}" ${d.cover ? `style="background-image:url('${d.cover}')"` : ''}>
        ${d.cover ? '' : `<span class="cover-glyph">${Z.esc((d.title || '知')[0])}</span>`}
        <span class="type-badge ${d.type}">${typeName}</span>
        ${d.source === 'demo' ? '<span class="demo-badge">示例</span>' : ''}
      </div>
      <div class="doc-body">
        <h3>${Z.esc(d.title)}</h3>
        <div class="doc-meta"><span>${lang}</span><span>${d.meta?.words || 0} 字词</span><span>${Z.relTime(d.updatedAt)}</span></div>
        <div class="doc-foot">
          <div class="mini-progress"><i style="width:${pct}%"></i></div>
          <span>${cards.length ? `${cards.length} 卡片 · ${pct}% 掌握` : '尚未生成卡片'}</span>
          <button class="ghost-icon tiny del-doc" data-del-doc="${d.id}" title="删除">${Z.icon('trash')}</button>
        </div>
      </div>
    </article>`;
  }

  /* ================= 资料页 ================= */
  function renderDoc(view, doc, routeInfo) {
    currentDocId = doc.id;
    doc.lastOpenedAt = Date.now();
    const queryTab = routeInfo.query.get('tab');
    const defaultTab = doc.type === 'knowledge' ? 'mindmap' : 'reader';
    let tab = queryTab || Z.store.get('lastTab.' + doc.id, defaultTab);
    if (!['reader', 'mindmap', 'cards', 'draw'].includes(tab)) tab = defaultTab;

    setCrumb(`<a href="#/home">文库</a><span class="crumb-sep">/</span><span>${Z.esc(Z.truncate(doc.title, 24))}</span>`);
    setTopActions(`<button class="btn ghost small" id="doc-export">${Z.icon('download')}导出</button><button class="btn ghost small" id="doc-delete">${Z.icon('trash')}</button>`);

    const langLabel = doc.lang === 'zh' ? '中文' : doc.lang === 'en' ? '英文' : '外文';
    view.innerHTML = `<div class="doc-page">
      <header class="doc-head">
        <a class="back-link" href="#/home">${Z.icon('back')}文库</a>
        <div class="doc-title-wrap">
          <div class="doc-title-line">
            <span class="type-badge ${doc.type}">${doc.type === 'knowledge' ? '知识型' : '课文型'}</span>
            <h1 id="doc-title">${Z.esc(doc.title)}</h1>
            <button class="ghost-icon tiny" id="doc-rename" title="重命名">${Z.icon('edit')}</button>
          </div>
          <div class="doc-meta"><span>${doc.source === 'image' ? '图片 OCR' : doc.source === 'pdf' ? 'PDF' : doc.source.toUpperCase()}</span><span>${langLabel}</span><span>${doc.meta?.words || 0} 字词</span><span>${Z.relTime(doc.createdAt)}</span></div>
        </div>
        <div class="doc-head-actions">
          <label class="switch-label">类型
            <select id="doc-type">
              <option value="knowledge" ${doc.type === 'knowledge' ? 'selected' : ''}>知识型</option>
              <option value="text" ${doc.type === 'text' ? 'selected' : ''}>课文型</option>
            </select>
          </label>
        </div>
      </header>
      ${doc.lang !== 'zh' && !Object.keys(doc.translations || {}).length ? `<div class="hint-banner" id="lang-hint">${Z.icon('translate')}<span>外文资料：开启双语，点词可朗读查义。</span><button class="btn ghost small" id="hint-bilingual">开启双语</button><button class="ghost-icon tiny" id="hint-close">${Z.icon('close')}</button></div>` : ''}
      <nav class="doc-tabs">
        ${tabBtn('reader', 'book', '阅读')}
        ${tabBtn('mindmap', 'mindmap', '思维导图')}
        ${tabBtn('cards', 'cards', '卡片')}
        ${tabBtn('draw', 'pen', '手绘')}
      </nav>
      <div id="doc-body" class="doc-body"></div>
    </div>`;

    Z.hydrateIcons(view);

    const save = Z.debounce(async () => {
      doc.updatedAt = Date.now();
      await Z.DB.putDoc(doc);
      const idx = docs.findIndex((d) => d.id === doc.id);
      if (idx >= 0) docs[idx] = doc;
    }, 350);

    const body = Z.$('#doc-body', view);
    function switchTab(name) {
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      Z.TTS.stop();
      document.body.classList.remove('focus-mode');
      Z.$$('.doc-tabs button', view).forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
      Z.store.set('lastTab.' + doc.id, name);
      body.innerHTML = '';
      if (name === 'reader') {
        const api = Z.Reader.mount(body, doc, { onChange: save });
        cleanup = api.destroy;
      } else if (name === 'mindmap') {
        if (!doc.mindmap) {
          doc.mindmap = { root: Z.Mindmap.buildFromBlocks(doc) };
          save();
        }
        const api = Z.Mindmap.mount(body, doc, {
          onChange: save,
          onJump: (i) => { switchTab('reader'); setTimeout(() => Z.scrollIntoViewSoft(Z.$(`.blk[data-i="${i}"]`)), 200); }
        });
        cleanup = api.destroy;
      } else if (name === 'cards') {
        Z.Review.renderDeck(body, doc, { onChange: save });
      } else if (name === 'draw') {
        const api = Z.Annotate.mount(body, doc, { onChange: save });
        cleanup = api.destroy;
      }
    }
    Z.$$('.doc-tabs button', view).forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    switchTab(tab);

    Z.$('#doc-rename', view)?.addEventListener('click', async () => {
      const t = await Z.promptText('重命名资料', doc.title);
      if (!t) return;
      doc.title = t;
      await Z.DB.putDoc(doc);
      Z.$('#doc-title').textContent = t;
      setCrumb(`<a href="#/home">文库</a><span class="crumb-sep">/</span><span>${Z.esc(Z.truncate(t, 24))}</span>`);
      Z.toast('已重命名', 'ok');
    });
    Z.$('#doc-type', view)?.addEventListener('change', async (e) => {
      doc.type = e.target.value;
      await Z.DB.putDoc(doc);
      Z.toast('类型已更新', 'ok');
      renderDoc(view, doc, { query: new URLSearchParams() });
    });
    Z.$('#doc-delete', view)?.addEventListener('click', async () => {
      if (!(await Z.confirm(`删除「${doc.title}」？高亮、卡片与批注都会一并删除。`, { danger: true, ok: '删除' }))) return;
      if (cleanup) cleanup();
      await Z.DB.deleteDoc(doc);
      if (doc.sourceBlobId) await Z.DB.deleteBlob(doc.sourceBlobId);
      Z.toast('已删除', 'ok');
      location.hash = '#/home';
      refresh();
    });
    Z.$('#doc-export', view)?.addEventListener('click', () => exportDoc(doc));
    Z.$('#hint-close', view)?.addEventListener('click', () => Z.$('#lang-hint')?.remove());
    Z.$('#hint-bilingual', view)?.addEventListener('click', () => {
      const btn = Z.$('.reader [data-act="bilingual"]');
      if (btn) btn.click();
      else { tab = 'reader'; switchTab('reader'); setTimeout(() => Z.$('.reader [data-act="bilingual"]')?.click(), 150); }
      Z.$('#lang-hint')?.remove();
    });

    function tabBtn(id, icon, label) {
      return `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${Z.icon(icon)}${label}</button>`;
    }
  }

  function exportDoc(doc) {
    const lines = [`# ${doc.title}`, ''];
    doc.blocks.forEach((b, i) => {
      const t = b.t || 'p';
      if (t === 'h1') lines.push('# ' + b.text, '');
      else if (t === 'h2') lines.push('## ' + b.text, '');
      else if (t === 'h3') lines.push('### ' + b.text, '');
      else if (t === 'li') lines.push('- ' + b.text);
      else if (t === 'quote') lines.push('> ' + b.text);
      else if (t === 'code') lines.push('```', b.text, '```');
      else lines.push(b.text, '');
      if (doc.translations[i]) lines.push('> 译：' + doc.translations[i], '');
    });
    if ((doc.highlights || []).length) {
      lines.push('', '## 高亮与笔记');
      doc.highlights.forEach((h) => lines.push(`- ${h.text}${h.note ? '　—— ' + h.note : ''}`));
    }
    if (doc.journal) lines.push('', '## 我的笔记', doc.journal);
    if ((doc.cards || []).length) {
      lines.push('', '## 记忆卡片');
      doc.cards.forEach((c) => lines.push(`- Q：${c.front}`, `  A：${(c.back || '').replace(/\n/g, '；')}`));
    }
    Z.download(doc.title.replace(/[\\/:*?"<>|]/g, '_') + '.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    Z.toast('已导出 Markdown', 'ok');
  }

  /* ================= 复习页 ================= */
  function renderReview(view) {
    setCrumb('<span>复习</span>');
    setTopActions('');
    Z.Review.mount(view, docs);
  }

  /* ================= 导入 ================= */
  function openImport() {
    const m = Z.modal({
      title: '导入资料',
      sub: '仅在本机解析，不上传',
      body: `<div class="import-modal">
        <div class="dropzone" id="dropzone">
          <span class="dz-ico">${Z.icon('upload')}</span>
          <strong>拖入文件，或点击选择</strong>
          <em>PDF · 图片 · DOCX · PPTX · MD · TXT</em>
          <input type="file" id="file-input" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.md,.markdown,.txt,.html,.htm">
        </div>
        <label class="wanted-box">希望提取什么（可选）
          <input class="input" id="wanted-input" placeholder="例如：只要题目和选项、只提取公式与定义、去掉页眉页脚">
        </label>
        <div class="wanted-chips">
          <button type="button" data-w="只保留正文，去掉页眉页脚、页码和广告">只要正文</button>
          <button type="button" data-w="只提取题目、选项和答案解析">只要题目</button>
          <button type="button" data-w="只提取公式、定理、定义与适用条件">只要公式定义</button>
          <button type="button" data-w="只提取英文单词、音标和例句">只要单词</button>
        </div>
        <div class="or-line"><span>或粘贴文本</span></div>
        <input class="input" id="paste-title" placeholder="标题（可选）">
        <textarea class="input area" id="paste-text" rows="6" placeholder="粘贴课文、知识点或笔记…"></textarea>
        <div class="paste-foot">
          <span class="muted small">导入前可校对识别结果</span>
          <button class="btn primary" id="paste-import">导入文本</button>
        </div>
        <div class="import-note">${Z.icon('info')}图片会先做灰度增强再 OCR；识别不准时可在下一步直接改字。</div>
      </div>`,
      footer: null
    });

    const dz = Z.$('#dropzone', m.root);
    const input = Z.$('#file-input', m.root);
    const wantedOf = () => (Z.$('#wanted-input', m.root)?.value || '').trim();
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      const wanted = wantedOf();
      m.close();
      await importFiles(input.files, wanted);
    });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', async (e) => {
      if (e.dataTransfer.files?.length) { const w = wantedOf(); m.close(); await importFiles(e.dataTransfer.files, w); }
    });
    Z.$$('.wanted-chips button', m.root).forEach((b) => b.addEventListener('click', () => {
      Z.$('#wanted-input', m.root).value = b.dataset.w;
      Z.$$('.wanted-chips button', m.root).forEach((x) => x.classList.toggle('on', x === b));
    }));
    Z.$('#paste-import', m.root).addEventListener('click', async () => {
      const text = Z.$('#paste-text', m.root).value.trim();
      if (!text) { Z.toast('粘贴内容为空', 'error'); return; }
      const title = Z.$('#paste-title', m.root).value.trim();
      const wanted = wantedOf();
      m.close();
      const doc = Z.Import.fromPlain(text, title, { wanted });
      openPreview(doc, wanted);
    });
    setTimeout(() => Z.$('#paste-text', m.root)?.focus(), 100);
  }

  /* 提取结果校对：直接在导入前改错字 */
  function openPreview(doc, wanted) {
    const toText = (d) => d.blocks
      .map((b) => {
        if (b.t && b.t[0] === 'h') return '#'.repeat(Math.min(3, Number(b.t[1] || 2))) + ' ' + b.text;
        return b.t === 'li' ? '- ' + b.text : b.text;
      })
      .join('\n\n');
    const conf = doc.meta?.ocrConfidence;
    const m = Z.modal({
      title: '确认提取结果',
      sub: '可先修改识别错误的文字，再导入',
      wide: true,
      body: `<div class="preview">
        <div class="preview-meta">
          <input class="input" id="pv-title" value="${Z.esc(doc.title)}" placeholder="标题">
          <span class="muted small">${doc.blocks.length} 段${conf ? ' · OCR 置信度 ' + conf + '%' : ''}${wanted ? ' · 要求：' + Z.esc(wanted) : ''}</span>
        </div>
        <textarea class="input area" id="pv-text" rows="15">${Z.esc(toText(doc))}</textarea>
        <div class="paste-foot">
          ${Z.AI.isChat() ? '<button class="btn ghost small" id="pv-ai"><span data-ico="sparkle"></span>按描述重新整理</button>' : ''}
          <span class="muted small">空行分段，## 表示标题</span>
          <button class="btn ghost" id="pv-cancel">取消</button>
          <button class="btn primary" id="pv-ok">确认导入</button>
        </div>
      </div>`,
      footer: null
    });
    Z.hydrateIcons(m.root);
    Z.$('#pv-cancel', m.root).addEventListener('click', () => m.close());
    Z.$('#pv-ai', m.root)?.addEventListener('click', async () => {
      const busy = Z.busy('正在按描述整理…', wanted || '整理成通顺正文');
      try {
        const next = await Z.Import.aiRefine(Object.assign({}, doc, { blocks: doc.blocks.slice() }), wanted);
        Z.$('#pv-text', m.root).value = toText(next);
        Z.toast('已重新整理，可继续校对', 'ok');
      } catch (e) {
        Z.toast(e.message, 'error', 4000);
      } finally { busy.close(); }
    });
    Z.$('#pv-ok', m.root).addEventListener('click', async () => {
      const text = Z.$('#pv-text', m.root).value.trim();
      const title = Z.$('#pv-title', m.root).value.trim();
      if (!text) { Z.toast('内容为空：可以粘贴文字或取消后重新导入', 'error'); return; }
      const finalDoc = Z.Import.fromEdited(text, doc, title);
      await Z.Import.saveDocs([finalDoc]);
      m.close();
      await loadDocs();
      Z.toast('已导入「' + finalDoc.title + '」', 'ok');
      location.hash = '#/doc/' + finalDoc.id + '?tab=' + (finalDoc.type === 'knowledge' ? 'mindmap' : 'reader');
    });
  }

  async function importFiles(files, wanted = '') {
    const added = await Z.Import.extractFiles(files, { wanted });
    if (!added.length) return;
    if (added.length === 1) { openPreview(added[0], wanted); return; }
    await Z.Import.saveDocs(added);
    await loadDocs();
    Z.toast(`已导入 ${added.length} 份资料`, 'ok');
    location.hash = '#/home';
    refresh();
  }

  Z.openImport = openImport;
  Z.importFiles = importFiles;

  /* ================= 设置 ================= */
  function renderSettings(view) {
    const ai = Z.AI.cfg();
    const target = Z.store.get('translate.target', 'auto');
    const rate = Z.TTS.getRate();
    const zhVoice = Z.store.get('tts.voice.zh', '');
    const enVoice = Z.store.get('tts.voice.en', '');
    const voices = Z.TTS.voices;
    const zhVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('zh'));
    const enVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));

    view.innerHTML = `<div class="settings">
      <div class="settings-head"><span class="eyebrow">SETTINGS</span><h1>设置</h1></div>

      <section class="set-card">
        <div class="set-title"><span class="set-ico">${Z.icon('moon')}</span><div><h3>外观</h3><p>选择底色与主色。</p></div></div>
        <div class="set-grid">
          <label>主题
            <div class="seg theme-seg">
              <button data-theme-set="paper" class="${document.documentElement.dataset.theme !== 'dark' ? 'on' : ''}">纸白</button>
              <button data-theme-set="dark" class="${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}">夜色</button>
            </div>
          </label>
          <label>色系
            <div class="palette-row">
              ${PALETTES.map((p) => `<button class="palette-dot ${Z.store.get('palette', 'ink') === p.id ? 'on' : ''}" data-palette="${p.id}" style="--c:${p.c}" title="${p.name}"><i></i><span>${p.name}</span></button>`).join('')}
            </div>
          </label>
        </div>
      </section>

      <section class="set-card">
        <div class="set-title"><span class="set-ico">${Z.icon('sparkle')}</span><div><h3>AI 增强</h3><p>浏览器内模型免费、离线；也可接云端接口。</p></div></div>
        <div class="set-grid">
          <label class="span2">模型来源
            <select id="ai-provider">
              ${Object.entries(Z.AI.PRESETS).map(([k, v]) => `<option value="${k}" ${ai.provider === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </label>
          <div class="span2 local-panel" id="agent-panel" ${ai.provider === 'agent' ? '' : 'hidden'}>
            <div class="local-status">内置智能体（GPT-OSS 20B）：免下载、免 Key，直接讲解、出题与翻译。</div>
            <div class="local-status">由公共推理服务提供；若网络无法访问，会自动退回在线知识库。</div>
          </div>
          <div class="span2 local-panel" id="online-panel" ${ai.provider === 'online' ? '' : 'hidden'}>
            <div class="local-status">免下载、免 Key：检索百度百科与萌娘百科，整理成定义、公式、条件、变式与自测，并保留来源链接。</div>
            <div class="local-status">需要联网。若检索不到或网络受限，可切换到本地模型或云端接口。</div>
          </div>
          <div class="span2 local-panel" id="local-panel" ${ai.provider === 'local' ? '' : 'hidden'}>
            <div class="local-row">
              <select id="local-model">
                ${Z.LocalAI.MODELS.map((m) => `<option value="${m.id}" ${Z.LocalAI.snapshot().modelId === m.id ? 'selected' : ''}>${m.name} · ${m.size}</option>`).join('')}
              </select>
              <button class="btn primary small" id="local-load">加载模型</button>
              <button class="btn ghost small" id="local-unload">卸载</button>
            </div>
            <div class="local-bar"><i id="local-fill"></i></div>
            <div class="local-status" id="local-status">${localStatusText()}</div>
            <div class="local-row">
              <input class="input" id="local-mirror" value="${Z.esc(Z.LocalAI.mirrorHost())}" placeholder="模型源地址">
              <button class="btn ghost small" id="local-mirror-save">保存源</button>
            </div>
          </div>
          <div class="span2 api-fields" id="api-fields" ${['local', 'online', 'agent'].includes(ai.provider) ? 'hidden' : ''}>
            <div class="set-grid">
              <label>模型
                <input class="input" id="ai-model" value="${Z.esc(ai.model)}" placeholder="deepseek-chat">
              </label>
              <label>API Key（只存本机）
                <input class="input" id="ai-key" type="password" value="${Z.esc(ai.apiKey)}" placeholder="sk-...">
              </label>
              <label class="span2">接口地址（OpenAI 兼容）
                <input class="input" id="ai-base" value="${Z.esc(ai.baseUrl)}" placeholder="https://api.deepseek.com/v1">
              </label>
            </div>
          </div>
        </div>
        <div class="set-actions">
          <button class="btn primary small" id="ai-save">保存</button>
          <button class="btn ghost small" id="ai-test">测试</button>
          <span class="set-status" id="ai-status">${Z.AI.isReady() ? '可用 · ' + Z.esc(Z.AI.label()) : '未就绪'}</span>
        </div>
        <p class="set-hint" id="ai-hint">${ai.provider === 'agent'
          ? '内置智能体：无需下载与 Key，联网即用。'
          : ai.provider === 'local'
            ? '首次加载需下载模型（约 480MB），之后缓存在本机，可离线使用。'
            : ai.provider === 'online'
              ? '在线知识库：不下载模型、不需要 Key，直接检索公开百科。'
              : '浏览器直连需服务商允许跨域。'}</p>
      </section>

      <section class="set-card">
        <div class="set-title"><span class="set-ico">${Z.icon('volume')}</span><div><h3>语音朗读</h3><p>点词或整段朗读。</p></div></div>
        <div class="set-grid">
          <label>中文语音
            <select id="voice-zh">${zhVoices.length ? `<option value="">自动选择</option>${zhVoices.map((v) => `<option value="${Z.esc(v.voiceURI)}" ${zhVoice === v.voiceURI ? 'selected' : ''}>${Z.esc(v.name)}</option>`).join('')}` : '<option value="">未发现中文语音</option>'}</select>
          </label>
          <label>英文语音
            <select id="voice-en">${enVoices.length ? `<option value="">自动选择</option>${enVoices.map((v) => `<option value="${Z.esc(v.voiceURI)}" ${enVoice === v.voiceURI ? 'selected' : ''}>${Z.esc(v.name)}</option>`).join('')}` : '<option value="">未发现英文语音</option>'}</select>
          </label>
          <label class="span2">语速 <input type="range" id="tts-rate" min="0.6" max="1.4" step="0.05" value="${rate}"><span id="tts-rate-label">${rate}×</span></label>
        </div>
        <div class="set-actions">
          <button class="btn ghost small" id="tts-test-en">试听英文</button>
          <button class="btn ghost small" id="tts-test-zh">试听中文</button>
          <span class="set-status">${Z.TTS.available() ? '系统语音可用' : '当前浏览器不支持语音'}</span>
        </div>
      </section>

      <section class="set-card">
        <div class="set-title"><span class="set-ico">${Z.icon('translate')}</span><div><h3>翻译</h3><p>未配置 AI 时用免费翻译，结果本地缓存。</p></div></div>
        <div class="set-grid">
          <label>翻译方向
            <select id="tr-target">
              <option value="auto" ${target === 'auto' ? 'selected' : ''}>自动（外文→中文，中文→英文）</option>
              <option value="zh" ${target === 'zh' ? 'selected' : ''}>始终译为中文</option>
              <option value="en" ${target === 'en' ? 'selected' : ''}>始终译为英文</option>
            </select>
          </label>
        </div>
        <div class="set-actions"><span class="set-status">${ai.apiKey ? '优先使用 AI 翻译' : '使用免费翻译 + 本地缓存'}</span></div>
      </section>

      <section class="set-card">
        <div class="set-title"><span class="set-ico">${Z.icon('key')}</span><div><h3>数据与隐私</h3><p>资料只存在本机，换设备请手动导出。</p></div></div>
        <div class="set-actions">
          <button class="btn ghost small" id="data-export">${Z.icon('download')}导出数据</button>
          <button class="btn ghost small" id="data-import-btn">${Z.icon('upload')}导入数据</button>
          <button class="btn ghost small danger" id="data-clear">清空全部数据</button>
          <input type="file" id="data-file" accept=".json" hidden>
          <span class="set-status" id="storage-status"></span>
        </div>
      </section>

      <section class="set-card about">
        <div class="about-brand"><span class="brand-mark">知</span><div><strong>知忆 ZHIYI</strong><em>把资料变成记得住的知识</em></div></div>
        <p>纯静态、本地优先。没有账号，资料不上传。</p>
        <p class="muted small">快捷键：U 导入 · Space 翻卡 · 1–4 评分 · Esc 退出</p>
      </section>
    </div>`;

    Z.hydrateIcons(view);

    Z.$$('[data-theme-set]', view).forEach((b) => b.addEventListener('click', () => {
      setTheme(b.dataset.themeSet);
      Z.$$('[data-theme-set]', view).forEach((x) => x.classList.toggle('on', x === b));
    }));
    Z.$$('[data-palette]', view).forEach((b) => b.addEventListener('click', () => {
      setPalette(b.dataset.palette);
      Z.$$('[data-palette]', view).forEach((x) => x.classList.toggle('on', x === b));
    }));

    Z.$('#ai-provider').addEventListener('change', (e) => {
      const v = e.target.value;
      const isLocal = v === 'local';
      const isOnline = v === 'online';
      const isAgent = v === 'agent';
      Z.$('#local-panel').hidden = !isLocal;
      Z.$('#online-panel').hidden = !isOnline;
      Z.$('#agent-panel').hidden = !isAgent;
      Z.$('#api-fields').hidden = isLocal || isOnline || isAgent;
      const hint = Z.$('#ai-hint');
      if (hint) hint.textContent = isAgent
        ? '内置智能体：无需下载与 Key，联网即用。'
        : isLocal
          ? '首次加载需下载模型（约 480MB），之后缓存在本机，可离线使用。'
          : isOnline
            ? '在线知识库：不下载模型、不需要 Key，直接检索公开百科。'
            : '浏览器直连需服务商允许跨域。';
      const p = Z.AI.PRESETS[v];
      if (p && !isLocal && !isOnline && !isAgent) {
        Z.$('#ai-base').value = p.baseUrl;
        Z.$('#ai-model').value = p.model;
      }
      if (isLocal) paintLocal(Z.LocalAI.snapshot());
    });
    Z.$('#local-model').addEventListener('change', (e) => {
      Z.AI.save({ provider: 'local', model: e.target.value });
      Z.$('#ai-hint').textContent = e.target.value.includes('1.5B')
        ? '首次加载需下载约 1.2GB，建议在有独显或高性能核显的设备上使用。'
        : '首次加载需下载模型（约 480MB），之后缓存在本机，可离线使用。';
    });
    Z.$('#local-mirror-save').addEventListener('click', () => {
      const v = Z.$('#local-mirror').value.trim();
      Z.store.set('local.mirror', v || Z.LocalAI.MIRROR);
      Z.$('#local-mirror').value = Z.LocalAI.mirrorHost();
      Z.toast('模型源已更新，重新加载生效', 'ok');
    });
    Z.$('#local-load').addEventListener('click', async () => {
      const model = Z.$('#local-model').value;
      Z.AI.save({ provider: 'local', model });
      Z.LocalAI.setProgressHandler(paintLocal);
      paintLocal(Z.LocalAI.snapshot());
      const snap = await Z.LocalAI.load(model);
      paintLocal(snap);
      if (snap.ready) Z.toast('本地模型已就绪', 'ok');
      else if (snap.error) Z.toast(snap.status || '加载失败', 'error', 5000);
    });
    Z.$('#local-unload').addEventListener('click', async () => {
      await Z.LocalAI.unload();
      paintLocal(Z.LocalAI.snapshot());
      Z.toast('已卸载，模型文件仍缓存', 'ok');
    });
    Z.$('#ai-save').addEventListener('click', () => {
      const provider = Z.$('#ai-provider').value;
      const patch = { provider };
      if (provider === 'local') {
        patch.model = Z.$('#local-model')?.value || Z.AI.PRESETS.local.model;
      } else if (provider === 'online') {
        patch.model = Z.AI.PRESETS.online.model;
      } else if (provider === 'agent') {
        patch.model = Z.AI.PRESETS.agent.model;
      } else {
        patch.model = Z.$('#ai-model').value.trim();
        patch.baseUrl = Z.$('#ai-base').value.trim();
        patch.apiKey = Z.$('#ai-key').value.trim();
      }
      Z.AI.save(patch);
      Z.$('#ai-status').textContent = Z.AI.isReady()
        ? '已保存 · ' + Z.AI.label()
        : provider === 'local' ? '已保存（模型未加载）' : '已保存（尚未填写 Key）';
      Z.toast('AI 设置已保存', 'ok');
    });
    Z.$('#ai-test').addEventListener('click', async () => {
      Z.$('#ai-save').click();
      if (!Z.AI.isReady()) {
        Z.toast(Z.AI.isLocal() ? '先点“加载模型”' : '请先填写 API Key', 'error');
        return;
      }
      const st = Z.$('#ai-status');
      st.innerHTML = '<span class="spinner small"></span> 测试中…';
      try {
        const r = await Z.AI.test();
        st.textContent = '正常：' + r;
        Z.toast('AI 可用', 'ok');
      } catch (e) {
        st.textContent = '失败：' + e.message;
        Z.toast(e.message, 'error', 4200);
      }
    });

    Z.$('#voice-zh').addEventListener('change', (e) => { Z.TTS.setVoice('zh', e.target.value); });
    Z.$('#voice-en').addEventListener('change', (e) => { Z.TTS.setVoice('en', e.target.value); });
    Z.$('#tts-rate').addEventListener('input', (e) => {
      Z.TTS.setRate(Number(e.target.value));
      Z.$('#tts-rate-label').textContent = e.target.value + '×';
    });
    Z.$('#tts-test-en').addEventListener('click', () => Z.TTS.speak('Memory is the residue of thought.', { lang: 'en' }));
    Z.$('#tts-test-zh').addEventListener('click', () => Z.TTS.speak('记忆是思考留下的痕迹。', { lang: 'zh' }));
    Z.$('#tr-target').addEventListener('change', (e) => {
      Z.store.set('translate.target', e.target.value);
      Z.toast('翻译方向已更新', 'ok');
    });

    Z.$('#data-export').addEventListener('click', async () => {
      const all = await Z.DB.allDocs();
      const clean = all.map((d) => {
        const c = JSON.parse(JSON.stringify(d));
        delete c.cover;
        return c;
      });
      Z.download(`zhiyi-backup-${Z.fmtDate()}.json`, JSON.stringify({ version: 1, docs: clean }, null, 2), 'application/json');
      Z.toast('已导出数据（不含封面图片）', 'ok');
    });
    Z.$('#data-import-btn').addEventListener('click', () => Z.$('#data-file').click());
    Z.$('#data-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        let n = 0;
        for (const d of data.docs || []) {
          d.id = d.id || Z.uid('doc');
          await Z.DB.putDoc(d);
          n++;
        }
        Z.toast(`已导入 ${n} 份资料`, 'ok');
        refresh();
      } catch (err) { Z.toast('导入失败：' + err.message, 'error'); }
    });
    Z.$('#data-clear').addEventListener('click', async () => {
      if (!(await Z.confirm('清空所有资料、卡片与批注？此操作不可恢复。', { danger: true, ok: '全部清空' }))) return;
      await Z.DB.clear();
      Z.toast('已清空', 'ok');
      location.hash = '#/home';
      refresh();
    });

    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        const el = Z.$('#storage-status');
        if (el) el.textContent = `已用 ${Z.bytes(est.usage || 0)} / 可用约 ${Z.bytes(est.quota || 0)}`;
      });
    }
  }

  /* ================= 全局事件 ================= */
  function bindGlobal() {
    Z.$('#rail-import')?.addEventListener('click', openImport);
    Z.$('#theme-toggle')?.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme === 'dark' ? 'paper' : 'dark';
      Z.store.set('theme', cur);
      applyTheme();
    });
    Z.$('#menu-btn')?.addEventListener('click', () => Z.$('#rail').classList.toggle('open'));
    Z.$('#app')?.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#/"]');
      if (!link) return;
      if (link.getAttribute('href') === location.hash) route();
    });

    // AI 助手：侧栏与首页共用
    document.addEventListener('click', (e) => {
      const dl = e.target.closest('[data-download-ai]');
      if (!dl) return;
      e.preventDefault();
      enableAI();
    });

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if (!typing && (e.key === 'u' || e.key === 'U')) {
        if (!Z.$('#modal-root .modal')) { e.preventDefault(); openImport(); }
      }
      if (!typing && (e.key === 'a' || e.key === 'A')) {
        if (!Z.$('#modal-root .modal')) { e.preventDefault(); enableAI(); }
      }
      if (e.key === 'Escape') document.body.classList.remove('focus-mode');
    });

    document.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragDepth++;
      Z.$('#drop-veil').hidden = false;
    });
    document.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) Z.$('#drop-veil').hidden = true;
    });
    document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', async (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      dragDepth = 0;
      Z.$('#drop-veil').hidden = true;
      await importFiles(e.dataTransfer.files);
    });

    window.addEventListener('hashchange', route);
  }

  async function init() {
    applyTheme();
    // 旧用户默认切到免下载的内置智能体；仍可在设置里改回
    if (!Z.store.get('aiMigrated', false)) {
      const cur = Z.store.get('ai', {});
      if (!cur.provider || cur.provider === 'local' || cur.provider === 'online') {
        Z.AI.save({ provider: 'agent', model: Z.AI.PRESETS.agent.model });
      }
      Z.store.set('aiMigrated', true);
    }
    Z.hydrateIcons(document);
    bindGlobal();
    Z.LocalAI.subscribe(updateAiUI);
    updateAiUI();
    await Z.Demo.seed();
    await route();
  }

  Z.App = { init, refresh, route, openImport, enableAI, get docs() { return docs; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.ZY);
