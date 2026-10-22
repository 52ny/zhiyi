/* 知忆 · 沉浸阅读器 */
(function (Z) {
  const HL_COLORS = [
    { id: 'yellow', name: '重点' },
    { id: 'green', name: '理解' },
    { id: 'pink', name: '疑问' },
    { id: 'blue', name: '延伸' }
  ];

  let ctx = null;

  function mount(container, doc, opts = {}) {
    ctx = {
      container, doc, opts,
      save: opts.onChange || (() => {}),
      bilingual: !!doc.bilingual,
      translating: false,
      ttsSession: null,
      activeBlock: -1,
      pendingSel: null,
      sideTab: 'outline'
    };
    if (!doc.highlights) doc.highlights = [];
    if (!doc.cards) doc.cards = [];
    if (!doc.translations) doc.translations = {};
    if (!doc.notes) doc.notes = [];
    container.innerHTML = shell();
    renderArticle();
    renderSide();
    bind();
    if (ctx.bilingual) applyBilingual(true);
    setTimeout(updateProgress, 600);
    return { destroy: destroy };
  }

  function shell() {
    const d = ctx.doc;
    const rate = Z.TTS.getRate();
    return `<div class="reader ${ctx.bilingual ? 'bilingual' : ''}">
      <div class="reader-controls">
        <div class="rc-group">
          <button class="rc-btn" data-act="font-down" title="缩小字号">A−</button>
          <button class="rc-btn" data-act="font-up" title="放大字号">A+</button>
          <button class="rc-btn ${ctx.bilingual ? 'on' : ''}" data-act="bilingual"><span data-ico="translate"></span>双语</button>
          <button class="rc-btn only-mobile" data-act="side"><span data-ico="list"></span>目录</button>
        </div>
        <div class="rc-group">
          <button class="rc-btn" data-act="play"><span data-ico="play"></span>朗读</button>
          <button class="rc-btn" data-act="stop" hidden><span data-ico="pause"></span>停止</button>
          <label class="rc-rate">语速
            <select data-act="rate">
              ${[0.7, 0.85, 1, 1.15, 1.3].map((r) => `<option value="${r}" ${Math.abs(rate - r) < 0.01 ? 'selected' : ''}>${r}×</option>`).join('')}
            </select>
          </label>
          <button class="rc-btn" data-act="focus" title="专注模式"><span data-ico="expand"></span></button>
        </div>
      </div>
      <div class="reader-grid">
        <article class="paper" id="paper" style="--reader-size:${Z.store.get('reader.size', 19)}px">
          ${blocksHtml()}
        </article>
        <aside class="reader-side" id="reader-side">
          <div class="side-tabs">
            <button class="side-tab ${ctx.sideTab === 'outline' ? 'on' : ''}" data-side="outline">目录</button>
            <button class="side-tab ${ctx.sideTab === 'excerpt' ? 'on' : ''}" data-side="excerpt">摘录</button>
            <button class="side-tab ${ctx.sideTab === 'words' ? 'on' : ''}" data-side="words">生词</button>
            <button class="side-tab ${ctx.sideTab === 'notes' ? 'on' : ''}" data-side="notes">笔记</button>
          </div>
          <div class="side-body" id="side-body"></div>
          <div class="side-foot">
            <div class="read-progress"><i id="read-progress-fill"></i></div>
            <span id="read-progress-text">阅读进度 0%</span>
          </div>
        </aside>
      </div>
      <div class="tts-player" id="tts-player" hidden>
        <div class="tts-wave"><i></i><i></i><i></i><i></i></div>
        <span id="tts-label">正在朗读…</span>
        <button class="ghost-icon" data-act="tts-pause" data-ico="pause"></button>
        <button class="ghost-icon" data-act="tts-stop" data-ico="close"></button>
      </div>
      <div class="selbar" id="selbar" hidden>
        ${HL_COLORS.map((c) => `<button class="hl-dot ${c.id}" data-color="${c.id}" title="${c.name}"></button>`).join('')}
        <span class="sel-sep"></span>
        <button class="sel-btn" data-sel="note"><span data-ico="note"></span>笔记</button>
        <button class="sel-btn" data-sel="speak"><span data-ico="volume"></span>朗读</button>
        <button class="sel-btn" data-sel="trans"><span data-ico="translate"></span>翻译</button>
      </div>
    </div>`;
  }

  function blocksHtml() {
    const doc = ctx.doc;
    let lastPage = null;
    return doc.blocks.map((b, i) => {
      if (!b.text) return '';
      const pageTag = b.page && b.page !== lastPage ? `<span class="page-mark">P.${b.page}</span>` : '';
      if (b.page) lastPage = b.page;
      const t = b.t || 'p';
      const trans = doc.translations[i];
      const transHidden = !(ctx.bilingual && trans);
      return `<div class="blk t-${t}" data-i="${i}" ${t[0] === 'h' ? 'id="sec-' + i + '"' : ''}>
        ${pageTag}
        <div class="blk-main" data-i="${i}">${inlineHtml(doc, i)}</div>
        <div class="blk-tools">
          <button class="blk-tool" data-act="read-block" data-i="${i}" title="朗读本段">${Z.icon('volume')}</button>
          <button class="blk-tool" data-act="trans-block" data-i="${i}" title="翻译本段">${Z.icon('translate')}</button>
          <button class="blk-tool" data-act="note-block" data-i="${i}" title="为整段加笔记">${Z.icon('note')}</button>
        </div>
        <div class="trans" data-trans="${i}" ${transHidden ? 'hidden' : ''}>${trans ? Z.esc(trans) : ''}</div>
      </div>`;
    }).join('');
  }

  function highlightRanges(i) {
    const len = ctx.doc.blocks[i]?.text.length || 0;
    return (ctx.doc.highlights || [])
      .filter((h) => h.block === i && h.end > h.start)
      .map((h) => ({ ...h, start: Z.clamp(h.start, 0, len), end: Z.clamp(h.end, 0, len) }))
      .filter((h) => h.end > h.start)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function inlineHtml(doc, i) {
    const block = doc.blocks[i];
    const text = block.text || '';
    if (block.t === 'code') return Z.esc(text);
    const hls = highlightRanges(i);
    if (!hls.length) return Z.esc(text);
    const cuts = new Set([0, text.length]);
    hls.forEach((h) => { cuts.add(h.start); cuts.add(h.end); });
    const points = Array.from(cuts).sort((a, b) => a - b);
    let out = '';
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k], b = points[k + 1];
      if (a === b) continue;
      const seg = text.slice(a, b);
      const active = hls.filter((h) => h.start <= a && h.end >= b).pop();
      if (active) {
        out += `<mark class="hl hl-${active.color || 'yellow'} ${active.note ? 'has-note' : ''}" data-hl="${active.id}" data-i="${i}">${Z.esc(seg)}</mark>`;
      } else {
        out += Z.esc(seg);
      }
    }
    return out;
  }

  function renderArticle() {
    const paper = Z.$('#paper', ctx.container);
    paper.innerHTML = blocksHtml();
    Z.hydrateIcons(paper);
  }

  function renderBlock(i) {
    const el = Z.$(`.blk[data-i="${i}"]`, ctx.container);
    if (!el) { renderArticle(); return; }
    const doc = ctx.doc;
    const b = doc.blocks[i];
    const t = b.t || 'p';
    const trans = doc.translations[i];
    const tmp = document.createElement('div');
    tmp.innerHTML = `<div class="blk t-${t}" data-i="${i}">
      ${b.page ? `<span class="page-mark">P.${b.page}</span>` : ''}
      <div class="blk-main" data-i="${i}">${inlineHtml(doc, i)}</div>
      <div class="blk-tools">
        <button class="blk-tool" data-act="read-block" data-i="${i}" title="朗读本段">${Z.icon('volume')}</button>
        <button class="blk-tool" data-act="trans-block" data-i="${i}" title="翻译本段">${Z.icon('translate')}</button>
        <button class="blk-tool" data-act="note-block" data-i="${i}" title="为整段加笔记">${Z.icon('note')}</button>
      </div>
      <div class="trans" data-trans="${i}" ${ctx.bilingual && trans ? '' : 'hidden'}>${trans ? Z.esc(trans) : ''}</div>
    </div>`;
    el.replaceWith(tmp.firstElementChild);
  }

  function renderSide() {
    const body = Z.$('#side-body', ctx.container);
    if (!body) return;
    const doc = ctx.doc;
    if (ctx.sideTab === 'outline') {
      const heads = doc.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.t && x.b.t[0] === 'h');
      let list = '';
      if (heads.length) {
        list = heads.map((x) => `<button class="outline-item lv-${x.b.t[1] || 2}" data-jump="${x.i}">${Z.esc(Z.truncate(x.b.text, 34))}</button>`).join('');
      } else {
        const pages = new Map();
        doc.blocks.forEach((b, i) => { if (b.page && !pages.has(b.page)) pages.set(b.page, i); });
        if (pages.size > 1) {
          list = Array.from(pages.entries()).map(([p, i]) => `<button class="outline-item lv-2" data-jump="${i}">第 ${p} 页</button>`).join('');
        } else {
          list = doc.blocks.filter((b) => b.t === 'p' && b.text.length > 40).slice(0, 20).map((b) => {
            const i = doc.blocks.indexOf(b);
            return `<button class="outline-item lv-2" data-jump="${i}">${Z.esc(Z.truncate(b.text, 30))}</button>`;
          }).join('');
        }
      }
      body.innerHTML = `<div class="outline">${list || '<p class="muted small">暂无目录</p>'}</div>`;
    } else if (ctx.sideTab === 'excerpt') {
      const list = (doc.highlights || []).slice().sort((a, b) => b.createdAt - a.createdAt);
      body.innerHTML = `<div class="excerpt-list">${list.length ? list.map((h) => `
        <div class="excerpt" data-hl="${h.id}" data-jump="${h.block}">
          <div class="excerpt-text hl-bar hl-${h.color || 'yellow'}">${Z.esc(Z.truncate(h.text, 60))}</div>
          ${h.note ? `<div class="excerpt-note">${Z.esc(Z.truncate(h.note, 70))}</div>` : ''}
          <div class="excerpt-foot"><span>${Z.relTime(h.createdAt)}</span><button class="mini-link" data-del-hl="${h.id}">删除</button></div>
        </div>`).join('') : '<p class="muted small">选中正文即可高亮并写笔记。</p>'}</div>`;
    } else if (ctx.sideTab === 'words') {
      const words = (doc.cards || []).filter((c) => c.kind === 'word');
      body.innerHTML = `<div class="word-list">${words.length ? words.map((c) => `
        <div class="word-item">
          <div class="word-head"><strong>${Z.esc(c.front)}</strong><button class="ghost-icon tiny" data-speak="${Z.esc(c.front)}" data-ico="volume"></button></div>
          <div class="word-def">${Z.esc(Z.truncate((c.back || '').replace(/\n/g, ' · '), 70))}</div>
        </div>`).join('') : '<p class="muted small">点击正文里的单词，可加入生词本并朗读。</p>'}</div>`;
    } else {
      body.innerHTML = `<div class="journal">
        <p class="muted small">随手写下你的理解、联想或口诀，会随资料一起保存。</p>
        <textarea class="input area" id="journal" rows="8" placeholder="用一句话解释这段内容…">${Z.esc(doc.journal || '')}</textarea>
      </div>`;
      const ta = Z.$('#journal', body);
      ta.addEventListener('input', Z.debounce(() => { doc.journal = ta.value; ctx.save(doc); }, 500));
    }
    Z.hydrateIcons(body);
  }

  function bind() {
    const root = ctx.container;
    root.addEventListener('click', onClick);
    root.addEventListener('mouseup', onMouseUp);
    root.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', outsideClose, true);
    window.addEventListener('resize', hideSelbar);
    root.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-act="rate"]');
      if (sel) { Z.TTS.setRate(Number(sel.value)); }
    });
  }

  function destroy() {
    Z.TTS.stop();
    hidePopover();
    hideSelbar();
    document.removeEventListener('mousedown', outsideClose, true);
    window.removeEventListener('resize', hideSelbar);
    document.body.classList.remove('focus-mode');
    if (ctx) ctx.ttsSession = null;
  }

  function outsideClose(e) {
    if (!e.target.closest('#popover') && !e.target.closest('.selbar')) {
      if (!e.target.closest('.hl')) hidePopover();
    }
    if (!e.target.closest('.selbar') && !e.target.closest('.paper')) hideSelbar();
  }

  function onClick(e) {
    const act = e.target.closest('[data-act]');
    if (act && ctx.container.contains(act)) {
      const a = act.dataset.act;
      if (a === 'font-up' || a === 'font-down') {
        const size = Z.clamp(Number(Z.store.get('reader.size', 19)) + (a === 'font-up' ? 1 : -1), 15, 30);
        Z.store.set('reader.size', size);
        Z.$('#paper', ctx.container).style.setProperty('--reader-size', size + 'px');
        return;
      }
      if (a === 'bilingual') { ctx.bilingual = !ctx.bilingual; applyBilingual(ctx.bilingual); return; }
      if (a === 'play') { playAll(); return; }
      if (a === 'stop') { stopAll(); return; }
      if (a === 'focus') { document.body.classList.toggle('focus-mode'); act.classList.toggle('on'); return; }
      if (a === 'side') { Z.$('.reader-side', ctx.container).classList.toggle('open'); return; }
      if (a === 'read-block') { readBlock(Number(act.dataset.i)); return; }
      if (a === 'trans-block') { translateBlock(Number(act.dataset.i)); return; }
      if (a === 'note-block') { openBlockNote(Number(act.dataset.i)); return; }
      if (a === 'tts-pause') { Z.TTS.togglePause(); updatePlayerBtn(); return; }
      if (a === 'tts-stop') { stopAll(); return; }
    }

    const side = e.target.closest('[data-side]');
    if (side) {
      ctx.sideTab = side.dataset.side;
      Z.$$('.side-tab', ctx.container).forEach((t) => t.classList.toggle('on', t === side));
      renderSide();
      return;
    }
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      const i = Number(jump.dataset.jump);
      const el = Z.$(`.blk[data-i="${i}"]`, ctx.container);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1600);
      }
      Z.$('.reader-side', ctx.container).classList.remove('open');
      return;
    }
    const del = e.target.closest('[data-del-hl]');
    if (del) {
      const id = del.dataset.delHl;
      const hl = ctx.doc.highlights.find((h) => h.id === id);
      ctx.doc.highlights = ctx.doc.highlights.filter((h) => h.id !== id);
      ctx.save(ctx.doc);
      if (hl) renderBlock(hl.block);
      renderSide();
      Z.toast('已删除高亮', 'ok');
      return;
    }
    const speakBtn = e.target.closest('[data-speak]');
    if (speakBtn) { Z.TTS.speakWord(speakBtn.dataset.speak, ctx.doc.lang); return; }

    const mark = e.target.closest('.hl');
    if (mark) {
      const hl = ctx.doc.highlights.find((h) => h.id === mark.dataset.hl);
      if (hl) {
        e.stopPropagation();
        openHighlightPopover(hl, mark.getBoundingClientRect());
      }
      return;
    }

    const main = e.target.closest('.blk-main');
    if (main) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      handleWordClick(e, main);
    }
  }

  function onMouseUp(e) {
    if (e.target.closest('#popover') || e.target.closest('.selbar') || e.target.closest('.blk-tools')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { hideSelbar(); return; }
      const range = sel.getRangeAt(0);
      const startMain = range.startContainer.parentElement?.closest('.blk-main');
      const endMain = range.endContainer.parentElement?.closest('.blk-main');
      if (!startMain || startMain !== endMain) { hideSelbar(); return; }
      const i = Number(startMain.dataset.i);
      const start = offsetIn(startMain, range.startContainer, range.startOffset);
      const end = offsetIn(startMain, range.endContainer, range.endOffset);
      const text = range.toString();
      if (!text.trim() || end <= start) { hideSelbar(); return; }
      ctx.pendingSel = { block: i, start, end, text };
      showSelbar(range.getBoundingClientRect());
    }, 10);
  }

  function offsetIn(root, node, offset) {
    const r = document.createRange();
    r.selectNodeContents(root);
    r.setEnd(node, offset);
    return r.toString().length;
  }

  function showSelbar(rect) {
    const bar = Z.$('#selbar', ctx.container);
    bar.hidden = false;
    const top = Math.max(8, rect.top - 46);
    const left = Z.clamp(rect.left + rect.width / 2 - 120, 8, window.innerWidth - 260);
    bar.style.top = top + 'px';
    bar.style.left = left + 'px';
    Z.hydrateIcons(bar);
  }
  function hideSelbar() {
    const bar = Z.$('#selbar', ctx.container);
    if (bar) bar.hidden = true;
  }

  function addHighlight(color, note = '') {
    const s = ctx.pendingSel;
    if (!s) return null;
    const hl = {
      id: Z.uid('hl'),
      block: s.block,
      start: s.start,
      end: s.end,
      text: s.text,
      color: color || 'yellow',
      note: note || '',
      createdAt: Date.now()
    };
    ctx.doc.highlights.push(hl);
    ctx.bilingual = ctx.bilingual; // 保持
    ctx.save(ctx.doc);
    window.getSelection()?.removeAllRanges();
    hideSelbar();
    renderBlock(hl.block);
    renderSide();
    return hl;
  }

  function openHighlightPopover(hl, rect) {
    const pop = Z.$('#popover');
    pop.hidden = false;
    pop.innerHTML = `<div class="pop-card">
      <div class="pop-quote hl-bar hl-${hl.color || 'yellow'}">${Z.esc(Z.truncate(hl.text, 120))}</div>
      <div class="pop-colors">${HL_COLORS.map((c) => `<button class="hl-dot ${c.id} ${hl.color === c.id ? 'on' : ''}" data-hc="${c.id}" title="${c.name}"></button>`).join('')}
        <button class="ghost-icon tiny" data-hact="speak" data-ico="volume" title="朗读"></button>
        <button class="ghost-icon tiny" data-hact="delete" data-ico="trash" title="删除"></button>
      </div>
      <textarea class="input area small" id="hl-note" rows="3" placeholder="写下为什么标记它…（可留空）">${Z.esc(hl.note || '')}</textarea>
      <div class="pop-foot"><button class="btn primary small" data-hact="save">保存笔记</button></div>
    </div>`;
    Z.hydrateIcons(pop);
    const w = 300;
    let left = rect.left + window.scrollX - w / 2;
    left = Z.clamp(left, 8, document.documentElement.clientWidth - w - 8);
    let top = rect.bottom + window.scrollY + 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    const ta = Z.$('#hl-note', pop);
    ta.addEventListener('input', Z.debounce(() => { hl.note = ta.value; ctx.save(ctx.doc); }, 500));
    pop.onclick = (e) => {
      const colorBtn = e.target.closest('[data-hc]');
      if (colorBtn) {
        hl.color = colorBtn.dataset.hc;
        ctx.save(ctx.doc);
        renderBlock(hl.block);
        renderSide();
        Z.$$('[data-hc]', pop).forEach((b) => b.classList.toggle('on', b === colorBtn));
        return;
      }
      const act = e.target.closest('[data-hact]')?.dataset.hact;
      if (!act) return;
      if (act === 'save') { hl.note = ta.value; ctx.save(ctx.doc); renderSide(); hidePopover(); Z.toast('笔记已保存', 'ok'); }
      if (act === 'delete') {
        ctx.doc.highlights = ctx.doc.highlights.filter((h) => h.id !== hl.id);
        ctx.save(ctx.doc); renderBlock(hl.block); renderSide(); hidePopover();
      }
      if (act === 'speak') Z.TTS.speak(hl.text, { lang: ctx.doc.lang });
    };
  }

  function hidePopover() {
    const pop = Z.$('#popover');
    if (pop) { pop.hidden = true; pop.onclick = null; }
  }

  async function handleWordClick(e, main) {
    if (!document.caretRangeFromPoint) return;
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || range.startContainer.nodeType !== 3) return;
    const node = range.startContainer;
    const off = range.startOffset;
    const data = node.data || '';
    if (!data.trim()) return;
    let a = off, b = off;
    const isWord = (ch) => /[A-Za-z'-]/.test(ch || '');
    if (isWord(data[off]) || isWord(data[off - 1])) {
      if (!isWord(data[a])) a = b = off - 1;
      while (a > 0 && isWord(data[a - 1])) a--;
      while (b < data.length && isWord(data[b])) b++;
    } else if (/[\u4e00-\u9fff]/.test(data[off] || data[off - 1] || '')) {
      a = off; b = off + 1;
      if (b < data.length && /[\u4e00-\u9fff]/.test(data[b]) && Math.random() > 0) b++;
      a = Math.max(0, off - 0);
      b = Math.min(data.length, a + 2);
    } else return;
    const word = data.slice(a, b).replace(/^[^A-Za-z\u4e00-\u9fff]+|[^A-Za-z\u4e00-\u9fff]+$/g, '');
    if (!word || word.length < 2) return;
    const blockEl = main.closest('.blk');
    const i = Number(blockEl.dataset.i);
    const nodeStart = offsetIn(main, node, 0);
    const rect = range.getBoundingClientRect();
    showWordPopover(word, { block: i, start: nodeStart + a, end: nodeStart + b, rect, context: ctx.doc.blocks[i].text });
  }

  async function showWordPopover(word, info) {
    const pop = Z.$('#popover');
    pop.hidden = false;
    pop.innerHTML = `<div class="pop-card word-card">
      <div class="word-title"><strong>${Z.esc(word)}</strong><button class="ghost-icon tiny" data-wact="speak" data-ico="volume"></button></div>
      <div class="word-loading"><span class="spinner small"></span> 查询中…</div>
      <div class="word-result" id="word-result"></div>
      <div class="pop-foot wrap">
        <button class="btn ghost small" data-wact="hl">加入高亮</button>
        <button class="btn primary small" data-wact="card">加入生词本</button>
      </div>
    </div>`;
    Z.hydrateIcons(pop);
    const w = 300;
    let left = info.rect.left + window.scrollX - w / 2;
    left = Z.clamp(left, 8, document.documentElement.clientWidth - w - 8);
    pop.style.left = left + 'px';
    pop.style.top = (info.rect.bottom + window.scrollY + 8) + 'px';

    let result = null;
    try {
      result = await Z.Translate.lookupWord(word);
    } catch (e) {}

    const resEl = Z.$('#word-result', pop);
    if (!resEl) return;
    if (!result) {
      resEl.innerHTML = '<p class="muted small">未查到释义，可直接朗读或用 AI 翻译整段。</p>';
    } else {
      resEl.innerHTML = `
        ${result.phonetic ? `<div class="word-phon">${Z.esc(result.phonetic)}</div>` : ''}
        ${result.cn ? `<div class="word-cn">${Z.esc(result.cn)}</div>` : ''}
        ${(result.defs || []).slice(0, 3).map((d) => `<div class="word-def"><em>${Z.esc(d.pos || '')}</em> ${Z.esc(d.def)}</div>`).join('')}`;
    }

    pop.onclick = (e) => {
      const act = e.target.closest('[data-wact]')?.dataset.wact;
      if (!act) return;
      if (act === 'speak') Z.TTS.speakWord(word, ctx.doc.lang);
      if (act === 'hl') {
        ctx.pendingSel = { block: info.block, start: info.start, end: info.end, text: word };
        addHighlight('blue');
        hidePopover();
      }
      if (act === 'card') {
        if (!ctx.doc.cards) ctx.doc.cards = [];
        const back = [result?.phonetic, result?.cn, ...(result?.defs || []).slice(0, 2).map((d) => d.def)].filter(Boolean).join('\n');
        ctx.doc.cards.push({
          id: Z.uid('card'),
          kind: 'word',
          front: word,
          back: back || '（待补充释义）',
          context: Z.truncate(info.context, 160),
          due: Date.now(),
          interval: 0, ease: 2.5, reps: 0, lapses: 0,
          createdAt: Date.now()
        });
        ctx.save(ctx.doc);
        renderSide();
        Z.toast(`「${word}」已加入生词本`, 'ok');
        hidePopover();
      }
    };
  }

  function openBlockNote(i) {
    const block = ctx.doc.blocks[i];
    const rect = Z.$(`.blk[data-i="${i}"]`, ctx.container).getBoundingClientRect();
    ctx.pendingSel = { block: i, start: 0, end: block.text.length, text: block.text };
    const hl = addHighlight('yellow');
    if (hl) openHighlightPopover(hl, rect);
    setTimeout(() => Z.$('#hl-note')?.focus(), 60);
  }

  function applyBilingual(on) {
    ctx.bilingual = on;
    ctx.doc.bilingual = on;
    ctx.save(ctx.doc);
    const reader = Z.$('.reader', ctx.container);
    if (reader) reader.classList.toggle('bilingual', on);
    const btn = Z.$('[data-act="bilingual"]', ctx.container);
    if (btn) btn.classList.toggle('on', on);
    Z.$$('.trans', ctx.container).forEach((el) => {
      const i = Number(el.dataset.trans);
      el.hidden = !(on && ctx.doc.translations[i]);
      el.textContent = ctx.doc.translations[i] || '';
    });
    if (on) translateMissing();
  }

  async function translateMissing() {
    if (ctx.translating) return;
    const doc = ctx.doc;
    const idxs = doc.blocks.map((b, i) => i).filter((i) => {
      const b = doc.blocks[i];
      return b.text && b.text.length > 1 && !doc.translations[i] && b.t !== 'code';
    });
    if (!idxs.length) return;
    ctx.translating = true;
    const btn = Z.$('[data-act="bilingual"]', ctx.container);
    const old = btn?.innerHTML;
    if (btn) btn.innerHTML = '<span class="spinner small"></span>翻译中';
    try {
      const texts = idxs.map((i) => doc.blocks[i].text);
      const res = await Z.Translate.translateBlocks(texts, { fromLang: doc.lang });
      let count = 0;
      idxs.forEach((i, k) => {
        const t = res[k];
        if (!t) return;
        doc.translations[i] = t;
        count++;
        const el = Z.$(`.trans[data-trans="${i}"]`, ctx.container);
        if (el) {
          el.textContent = t;
          el.hidden = !ctx.bilingual;
        }
      });
      ctx.save(doc);
      Z.toast(count ? `已翻译 ${count} 段` : '翻译失败，请检查网络或配置 AI', count ? 'ok' : 'error');
    } catch (e) {
      Z.toast('翻译失败：' + e.message, 'error');
    } finally {
      ctx.translating = false;
      if (btn && old) btn.innerHTML = old;
      if (btn) btn.classList.toggle('on', ctx.bilingual);
      Z.hydrateIcons(btn);
    }
  }

  async function translateBlock(i) {
    const doc = ctx.doc;
    if (doc.translations[i]) {
      ctx.bilingual = true;
      applyBilingual(true);
      return;
    }
    const el = Z.$(`.trans[data-trans="${i}"]`, ctx.container);
    if (el) { el.hidden = false; el.textContent = '翻译中…'; }
    try {
      const res = await Z.Translate.translateBlocks([doc.blocks[i].text], { fromLang: doc.lang });
      if (res[0]) {
        doc.translations[i] = res[0];
        ctx.save(doc);
        if (el) { el.textContent = res[0]; el.hidden = false; }
        const reader = Z.$('.reader', ctx.container);
        if (reader) reader.classList.add('bilingual');
      } else {
        if (el) el.hidden = true;
        Z.toast('翻译失败', 'error');
      }
    } catch (e) {
      if (el) el.hidden = true;
      Z.toast('翻译失败：' + e.message, 'error');
    }
  }

  function readBlock(i) {
    const b = ctx.doc.blocks[i];
    if (!b) return;
    stopAll();
    markBlock(i);
    const player = Z.$('#tts-player', ctx.container);
    player.hidden = false;
    Z.$('#tts-label', ctx.container).textContent = Z.truncate(b.text, 36);
    Z.TTS.speak(b.text, {
      lang: ctx.doc.lang,
      onend: () => { unmarkBlock(); player.hidden = true; }
    });
    ctx.activeBlock = i;
    Z.$('[data-act="stop"]', ctx.container)?.removeAttribute('hidden');
  }

  function playAll() {
    stopAll();
    const items = [];
    ctx.doc.blocks.forEach((b, i) => {
      if (b.text && b.text.length > 1 && b.t !== 'code') items.push({ i, text: b.text });
    });
    if (!items.length) return;
    const player = Z.$('#tts-player', ctx.container);
    player.hidden = false;
    Z.$('[data-act="stop"]', ctx.container)?.removeAttribute('hidden');
    const list = items.map((x) => x.text);
    let current = 0;
    const session = Z.TTS.speakSentences(list, {
      lang: ctx.doc.lang,
      onSentence: (k) => {
        current = k;
        unmarkBlock();
        markBlock(items[k].i);
        Z.$('#tts-label', ctx.container).textContent = Z.truncate(items[k].text, 36);
      },
      onDone: () => { player.hidden = true; unmarkBlock(); Z.$('[data-act="stop"]', ctx.container)?.setAttribute('hidden', ''); }
    });
    ctx.ttsSession = session;
  }

  function stopAll() {
    if (ctx.ttsSession) { ctx.ttsSession.cancel(); ctx.ttsSession = null; }
    Z.TTS.stop();
    unmarkBlock();
    const player = Z.$('#tts-player', ctx.container);
    if (player) player.hidden = true;
    const stopBtn = Z.$('[data-act="stop"]', ctx.container);
    if (stopBtn) stopBtn.setAttribute('hidden', '');
  }

  function markBlock(i) {
    unmarkBlock();
    const el = Z.$(`.blk[data-i="${i}"]`, ctx.container);
    if (el) {
      el.classList.add('speaking');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  function unmarkBlock() {
    Z.$$('.blk.speaking', ctx.container).forEach((el) => el.classList.remove('speaking'));
  }
  function updatePlayerBtn() {}

  function onScroll() {
    const root = ctx.container;
    const r = Z.$('.reader-grid', root);
    if (!r) return;
    const rect = r.getBoundingClientRect();
    const total = Math.max(1, r.scrollHeight - window.innerHeight);
    const pct = Z.clamp(Math.round((-rect.top + 80) / total * 100), 0, 100);
    const fill = Z.$('#read-progress-fill', root);
    const text = Z.$('#read-progress-text', root);
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = '阅读进度 ' + pct + '%';
  }

  function updateProgress() {
    onScroll();
  }

  Z.Reader = { mount, HL_COLORS };
})(window.ZY);
