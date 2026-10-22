/* 知忆 · 卡片与间隔复习 */
(function (Z) {
  const DAY = 86400000;
  let session = null;

  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function log() { return Z.store.get('review.log', { dates: [], total: 0 }); }
  function markReviewed() {
    const l = log();
    const t = todayKey();
    if (!l.dates.includes(t)) l.dates.push(t);
    l.total = (l.total || 0) + 1;
    l.dates = l.dates.slice(-90);
    Z.store.set('review.log', l);
  }
  function streak() {
    const l = log();
    const set = new Set(l.dates || []);
    let n = 0;
    const d = new Date();
    if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
    while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function allCards(docs) {
    const out = [];
    docs.forEach((doc) => (doc.cards || []).forEach((card) => out.push({ doc, card })));
    return out;
  }

  function stats(docs) {
    const cards = allCards(docs);
    const now = Date.now();
    const due = cards.filter((x) => (x.card.due || 0) <= now);
    const mastered = cards.filter((x) => (x.card.interval || 0) >= 21);
    const words = cards.filter((x) => x.card.kind === 'word');
    return { cards: cards.length, due: due.length, mastered: mastered.length, words: words.length, streak: streak(), totalReviews: log().total || 0 };
  }

  /* ---------- 复习总览 ---------- */
  function mount(container, docs) {
    const s = stats(docs);
    const due = allCards(docs).filter((x) => (x.card.due || 0) <= Date.now()).sort((a, b) => (a.card.due || 0) - (b.card.due || 0));
    const byDoc = new Map();
    due.forEach((x) => { byDoc.set(x.doc.id, (byDoc.get(x.doc.id) || 0) + 1); });
    const wordList = allCards(docs).filter((x) => x.card.kind === 'word');

    container.innerHTML = `<div class="review-page">
      <div class="review-head">
        <div>
          <span class="eyebrow">SPACED REPETITION</span>
          <h1>今天该记住什么？</h1>
          <p>在快要忘记的时候复习。</p>
        </div>
        <div class="streak-card">
          <span class="flame">${Z.icon('flame')}</span>
          <strong>${s.streak}</strong><span>天连续复习</span>
        </div>
      </div>

      <div class="review-top">
        <div class="due-card">
          <div class="due-ring">
            <svg viewBox="0 0 120 120">
              <circle class="ring-track" cx="60" cy="60" r="52" stroke-width="10"/>
              <circle class="ring-fill" cx="60" cy="60" r="52" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - Math.min(1, s.due / Math.max(1, s.cards)))}"
                transform="rotate(-90 60 60)"/>
            </svg>
            <div class="due-num"><strong>${s.due}</strong><span>待复习</span></div>
          </div>
          <div class="due-info">
            <strong>${s.due ? '有 ' + s.due + ' 张卡片到期' : '今天的复习已完成'}</strong>
            <span>卡片总数 ${s.cards} · 已掌握 ${s.mastered} · 累计复习 ${s.totalReviews} 次</span>
            <div class="due-actions">
              <button class="btn primary" id="start-review" ${s.due ? '' : 'disabled'}><span data-ico="play"></span>${s.due ? '开始复习' : '暂无到期卡片'}</button>
              <button class="btn ghost" id="browse-cards">浏览全部卡片</button>
            </div>
          </div>
        </div>
        <div class="due-docs">
          <h4>到期分布</h4>
          ${byDoc.size ? Array.from(byDoc.entries()).slice(0, 6).map(([id, n]) => {
            const doc = docs.find((d) => d.id === id);
            return `<div class="due-doc"><span>${Z.esc(Z.truncate(doc?.title || '未知资料', 22))}</span><em>${n}</em></div>`;
          }) : '<p class="muted small">暂无到期卡片。</p>'}
        </div>
      </div>

      <div class="method-section">
        <h2>记忆方法</h2>
        <div class="method-grid wide">
          <div class="method-card"><span class="method-no">A</span><h4>间隔重复</h4><p>按遗忘曲线安排时机。</p></div>
          <div class="method-card"><span class="method-no">B</span><h4>主动回忆</h4><p>先回想，再看答案。</p></div>
          <div class="method-card"><span class="method-no">C</span><h4>双重编码</h4><p>文字配图，双通道记忆。</p></div>
          <div class="method-card"><span class="method-no">D</span><h4>精细提问</h4><p>多问为什么、换掉变量呢。</p></div>
          <div class="method-card"><span class="method-no">E</span><h4>费曼技巧</h4><p>讲给外行听，卡住处即缺口。</p></div>
          <div class="method-card"><span class="method-no">F</span><h4>跟读</h4><p>点词听音，借语境记词。</p></div>
        </div>
      </div>

      ${wordList.length ? `<div class="wordbook">
        <div class="wordbook-head"><h2>生词本</h2><span>${wordList.length} 个词</span></div>
        <div class="wordbook-grid">
          ${wordList.slice(0, 40).map(({ doc, card }) => `<div class="wb-item">
            <div><strong>${Z.esc(card.front)}</strong><button class="ghost-icon tiny" data-speak="${Z.esc(card.front)}">${Z.icon('volume')}</button></div>
            <p>${Z.esc(Z.truncate((card.back || '').replace(/\n/g, ' · '), 60))}</p>
            <span class="wb-src">${Z.esc(Z.truncate(doc.title, 16))}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

    Z.hydrateIcons(container);
    Z.$('#start-review', container)?.addEventListener('click', () => startSession(docs, due));
    Z.$('#browse-cards', container)?.addEventListener('click', () => browseAll(docs));
    container.addEventListener('click', (e) => {
      const sp = e.target.closest('[data-speak]');
      if (sp) Z.TTS.speakWord(sp.dataset.speak, 'en');
    });
  }

  /* ---------- 复习会话 ---------- */
  function startSession(docs, queue) {
    const q = (queue || allCards(docs).filter((x) => (x.card.due || 0) <= Date.now()))
      .sort((a, b) => (a.card.due || 0) - (b.card.due || 0))
      .slice(0, 25);
    if (!q.length) { Z.toast('暂无到期卡片', 'info'); return; }
    session = { docs, queue: q, idx: 0, done: 0, remembered: 0, total: q.length, flipped: false, failed: 0 };
    renderSession();
  }

  function renderSession() {
    let veil = Z.$('#session-veil');
    if (veil) veil.remove();
    if (!session || session.idx >= session.queue.length) { finishSession(); return; }
    const item = session.queue[session.idx];
    const { doc, card } = item;
    veil = document.createElement('div');
    veil.id = 'session-veil';
    veil.className = 'session-veil';
    const isWord = card.kind === 'word';
    veil.innerHTML = `<div class="session">
      <div class="session-top">
        <div class="session-progress"><i style="width:${Math.round(session.done / session.total * 100)}%"></i></div>
        <span>${session.done} / ${session.total}</span>
        <button class="ghost-icon" id="session-exit" data-ico="close"></button>
      </div>
      <div class="flashcard ${session.flipped ? 'flipped' : ''}" id="flashcard">
        <div class="fc-meta">
          <span class="fc-kind">${isWord ? '生词' : card.kind === 'translate' ? '翻译' : card.kind === 'cloze' ? '填空' : '问答'}</span>
          <span>${Z.esc(Z.truncate(doc.title, 24))}</span>
          ${isWord ? `<button class="ghost-icon tiny" id="fc-speak">${Z.icon('volume')}</button>` : ''}
        </div>
        <div class="fc-front">${Z.esc(card.front)}</div>
        <div class="fc-back">
          ${(card.back || '').split('\n').map((x) => `<p>${Z.esc(x)}</p>`).join('')}
          ${card.context ? `<blockquote>${Z.esc(card.context)}</blockquote>` : ''}
        </div>
        <div class="fc-hint">${session.flipped ? '' : '先在心里回答，再翻面'}</div>
      </div>
      <div class="session-actions">
        ${session.flipped ? `
          <button class="rate r0" data-rate="0"><strong>忘记</strong><span>重来</span></button>
          <button class="rate r1" data-rate="1"><strong>模糊</strong><span>很快再见</span></button>
          <button class="rate r2" data-rate="2"><strong>记住</strong><span>按计划</span></button>
          <button class="rate r3" data-rate="3"><strong>简单</strong><span>拉长间隔</span></button>
        ` : `<button class="btn primary wide" id="flip-btn">显示答案 <kbd>Space</kbd></button>`}
      </div>
      <div class="session-tip">1 忘记 · 2 模糊 · 3 记住 · 4 简单</div>
    </div>`;
    document.body.appendChild(veil);
    Z.hydrateIcons(veil);

    Z.$('#session-exit').onclick = exitSession;
    Z.$('#flip-btn')?.addEventListener('click', flip);
    Z.$('#fc-speak')?.addEventListener('click', () => Z.TTS.speakWord(card.front, 'en'));
    Z.$$('[data-rate]', veil).forEach((b) => b.addEventListener('click', () => rate(Number(b.dataset.rate))));
    if (session.flipped) {
      const back = Z.$('.fc-back', veil);
      if (back) back.scrollTop = 0;
    }
  }

  function flip() {
    if (!session || session.flipped) return;
    session.flipped = true;
    const fc = Z.$('#flashcard');
    const actions = Z.$('.session-actions');
    if (fc) fc.classList.add('flipped');
    if (actions) {
      actions.innerHTML = `
        <button class="rate r0" data-rate="0"><strong>忘记</strong><span>重来</span></button>
        <button class="rate r1" data-rate="1"><strong>模糊</strong><span>很快再见</span></button>
        <button class="rate r2" data-rate="2"><strong>记住</strong><span>按计划</span></button>
        <button class="rate r3" data-rate="3"><strong>简单</strong><span>拉长间隔</span></button>`;
      Z.$$('[data-rate]', actions).forEach((b) => b.addEventListener('click', () => rate(Number(b.dataset.rate))));
    }
    Z.$('.fc-hint')?.remove();
  }

  async function rate(r) {
    if (!session || !session.flipped) return;
    const item = session.queue[session.idx];
    const c = item.card;
    const now = Date.now();
    c.ease = c.ease || 2.5;
    if (r === 0) {
      c.interval = 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
      c.lapses = (c.lapses || 0) + 1;
      c.reps = 0;
      session.failed++;
      session.queue.splice(Math.min(session.queue.length, session.idx + 3), 0, item);
      session.total++;
    } else {
      if (r === 1) {
        c.interval = Math.max(1, Math.round((c.interval || 1) * 1.25));
        c.ease = Math.max(1.3, c.ease - 0.12);
      } else if (r === 2) {
        c.interval = c.reps ? Math.max(1, Math.round((c.interval || 1) * c.ease)) : 1;
      } else {
        c.interval = c.reps ? Math.max(1, Math.round((c.interval || 1) * c.ease * 1.3)) : 3;
        c.ease = Math.min(3.2, c.ease + 0.12);
      }
      c.reps = (c.reps || 0) + 1;
      c.due = now + c.interval * DAY;
      session.remembered++;
    }
    c.lastReviewed = now;
    session.done++;
    session.idx++;
    session.flipped = false;
    markReviewed();
    try { await Z.DB.putDoc(item.doc); } catch (e) {}
    renderSession();
  }

  function exitSession() {
    const veil = Z.$('#session-veil');
    if (veil) veil.remove();
    session = null;
    document.removeEventListener('keydown', sessionKeys);
    if (location.hash === '#/review') Z.App?.route();
    else location.hash = '#/review';
  }

  function finishSession() {
    const s = session;
    if (!s) return;
    document.removeEventListener('keydown', sessionKeys);
    let veil = Z.$('#session-veil');
    const pct = Math.round(s.remembered / Math.max(1, s.done) * 100);
    veil.innerHTML = `<div class="session finish">
      <div class="finish-card">
        <span class="eyebrow">SESSION COMPLETE</span>
        <h2>这一轮记住了 ${s.remembered} 张</h2>
        <div class="finish-ring">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="rgba(23,107,91,.12)" stroke-width="10"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="#176b5b" stroke-width="10" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 52}" stroke-dashoffset="${2 * Math.PI * 52 * (1 - pct / 100)}" transform="rotate(-90 60 60)"/></svg>
          <div><strong>${pct}%</strong><span>本轮记住</span></div>
        </div>
        <p>${s.failed ? `有 ${s.failed} 张需要重来，它们会在本轮稍后再次出现。` : '全部一次通过，可以放心离开。'}</p>
        <div class="finish-actions">
          <button class="btn primary" id="finish-back">回到复习页</button>
        </div>
        <div class="finish-quote">“记忆不是一次存进去，而是一次次取出来。”</div>
      </div>
    </div>`;
    Z.hydrateIcons(veil);
    Z.$('#finish-back').onclick = () => {
      veil.remove();
      session = null;
      if (location.hash === '#/review') Z.App?.route();
      else location.hash = '#/review';
    };
  }

  function sessionKeys(e) {
    if (!session) return;
    if (e.code === 'Space') { e.preventDefault(); session.flipped ? null : flip(); }
    if (session.flipped && ['1', '2', '3', '4'].includes(e.key)) rate(Number(e.key) - 1);
    if (e.key === 'Escape') exitSession();
  }
  document.addEventListener('keydown', sessionKeys);

  function browseAll(docs) {
    const items = allCards(docs);
    const m = Z.modal({
      title: '全部卡片',
      sub: `共 ${items.length} 张 · 到期 ${stats(docs).due} 张`,
      wide: true,
      body: `<div class="browse-list">${items.length ? items.map(({ doc, card }) => `
        <div class="browse-item">
          <div class="bi-top"><span class="fc-kind">${card.kind === 'word' ? '生词' : card.kind === 'translate' ? '翻译' : '问答'}</span><span>${Z.esc(Z.truncate(doc.title, 30))}</span><span class="bi-due">${(card.due || 0) <= Date.now() ? '待复习' : '已安排'}</span></div>
          <details><summary>${Z.esc(Z.truncate(card.front, 80))}</summary><div class="bi-back">${Z.esc(card.back || '').replace(/\n/g, '<br>')}</div></details>
        </div>`).join('') : '<p class="muted">还没有卡片。打开资料，在「卡片」标签中生成。</p>'}</div>`
    });
    m.body.addEventListener('click', (e) => {
      const sp = e.target.closest('[data-speak]');
      if (sp) Z.TTS.speakWord(sp.dataset.speak, 'en');
    });
  }

  /* ---------- 资料卡片面板 ---------- */
  function renderDeck(container, doc, opts = {}) {
    const cards = doc.cards || [];
    const due = cards.filter((c) => (c.due || 0) <= Date.now()).length;
    container.innerHTML = `<div class="deck">
      <div class="deck-head">
        <div>
          <h3>记忆卡片 <em>${cards.length}</em></h3>
          <p>${cards.length ? `${due} 张到期 · 点击卡片查看答案` : '从高亮、标题、译文自动生成，或让 AI 出题。'}</p>
        </div>
        <div class="deck-actions">
          <button class="btn primary small" id="deck-study" ${due ? '' : 'disabled'}>${Z.icon('play')}复习本资料</button>
          <button class="btn ghost small" id="deck-gen">${Z.icon('sparkle')}智能生成</button>
          <button class="btn ghost small" id="deck-ai">${Z.icon('lab')}AI 出题</button>
        </div>
      </div>
      <div class="deck-list">
        ${cards.length ? cards.map((c) => `<details class="deck-item">
          <summary>
            <span class="fc-kind">${c.kind === 'word' ? '生词' : c.kind === 'translate' ? '翻译' : c.kind === 'cloze' ? '填空' : '问答'}</span>
            <span class="di-front">${Z.esc(c.front)}</span>
            <span class="di-due">${(c.due || 0) <= Date.now() ? '待复习' : '已安排'}</span>
          </summary>
          <div class="di-back">${Z.esc(c.back || '').replace(/\n/g, '<br>')}${c.context ? `<blockquote>${Z.esc(c.context)}</blockquote>` : ''}</div>
          <div class="di-actions">
            ${c.kind === 'word' ? `<button class="mini-link" data-speak="${Z.esc(c.front)}">朗读</button>` : ''}
            <button class="mini-link" data-del-card="${c.id}">删除</button>
          </div>
        </details>`).join('') : '<div class="deck-empty">还没有卡片。点「智能生成」从高亮与标题自动出题。</div>'}
      </div>
    </div>`;
    Z.hydrateIcons(container);

    const save = async () => { await Z.DB.putDoc(doc); if (opts.onChange) opts.onChange(doc); };

    Z.$('#deck-study', container)?.addEventListener('click', () => {
      startSession([doc], cards.filter((c) => (c.due || 0) <= Date.now()).map((card) => ({ doc, card })));
    });
    Z.$('#deck-gen', container)?.addEventListener('click', async () => {
      const n = generateHeuristicCards(doc);
      await save();
      Z.toast(n ? `生成了 ${n} 张卡片` : '没有发现可生成的新内容', n ? 'ok' : 'info');
      renderDeck(container, doc, opts);
    });
    Z.$('#deck-ai', container)?.addEventListener('click', async () => {
      if (!Z.AI.isChat()) { Z.toast('AI 出题需要本地模型或云端接口', 'error'); return; }
      const busy = Z.busy('AI 正在出题…', '从资料中提取可考的记忆点');
      try {
        const text = doc.blocks.map((b) => b.text).join('\n');
        const data = await Z.AI.cards(text, 10);
        let n = 0;
        (data.cards || []).forEach((c) => {
          if (!c.front || !c.back) return;
          if (cards.some((x) => x.front === c.front)) return;
          cards.push({
            id: Z.uid('card'), kind: 'qa', front: c.front, back: c.back, tag: c.tag,
            due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now()
          });
          n++;
        });
        await save();
        busy.close();
        Z.toast(`AI 生成了 ${n} 张卡片`, 'ok');
        renderDeck(container, doc, opts);
      } catch (e) { busy.close(); Z.toast('AI 出题失败：' + e.message, 'error'); }
    });

    container.addEventListener('click', async (e) => {
      const sp = e.target.closest('[data-speak]');
      if (sp) { Z.TTS.speakWord(sp.dataset.speak, doc.lang); return; }
      const del = e.target.closest('[data-del-card]');
      if (del) {
        doc.cards = doc.cards.filter((c) => c.id !== del.dataset.delCard);
        await save();
        renderDeck(container, doc, opts);
      }
    });
  }

  /* ---------- 启发式卡片生成 ---------- */
  const STOP = new Set('the and that this with from have will your what when where which their there about into than then them they these those been being were was are for not but you can could should would may might must more most some such only also very just like over under between during before after above below'.split(' '));

  function keyTerm(text, lang) {
    if (lang === 'zh') {
      const m = text.match(/([\u4e00-\u9fff]{2,8})(?=：|是指|是|定义|表示|称为)/);
      if (m) return m[1];
      const ch = text.match(/[\u4e00-\u9fff]{4,8}/g);
      return ch ? ch.sort((a, b) => b.length - a.length)[0].slice(0, 4) : '';
    }
    const words = text.match(/[A-Za-z][A-Za-z-]{5,}/g) || [];
    const term = words.filter((w) => !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0];
    return term || '';
  }

  function generateHeuristicCards(doc) {
    if (!doc.cards) doc.cards = [];
    const existing = new Set(doc.cards.map((c) => c.front));
    let added = 0;
    const push = (kind, front, back, extra = {}) => {
      if (!front || !back || existing.has(front)) return;
      if (doc.cards.length >= 80) return;
      existing.add(front);
      doc.cards.push({
        id: Z.uid('card'), kind, front: front.trim(), back: back.trim(),
        due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now(), ...extra
      });
      added++;
    };

    // 1) 高亮 → 填空
    (doc.highlights || []).slice(0, 20).forEach((h) => {
      const term = keyTerm(h.text, doc.lang);
      if (term && h.text.includes(term)) {
        push('cloze', h.text.replace(term, '_____'), h.text + (h.note ? `\n我的笔记：${h.note}` : ''));
      } else if (h.note) {
        push('qa', `我为什么标记这段内容？\n「${Z.truncate(h.text, 70)}」`, h.note);
      }
    });

    // 2) 标题 + 内容
    let current = null, buffer = [];
    const flush = () => {
      if (current && buffer.length) {
        push('qa', `「${current}」的关键内容是什么？`, buffer.slice(0, 3).join(' '));
      }
      buffer = [];
    };
    doc.blocks.forEach((b) => {
      if (b.t && b.t[0] === 'h') { flush(); current = b.text; }
      else if (current && b.text) buffer.push(b.text);
    });
    flush();

    // 3) 已翻译段落 → 翻译卡
    Object.keys(doc.translations || {}).slice(0, 8).forEach((k) => {
      const i = Number(k);
      const b = doc.blocks[i];
      if (!b) return;
      const t = doc.translations[i];
      if (!t || !b.text) return;
      if (doc.lang === 'zh') push('translate', t, b.text);
      else push('translate', b.text, t);
    });

    return added;
  }

  Z.Review = {
    mount, stats, startSession, renderDeck, generateHeuristicCards, allCards, streak, todayKey
  };
})(window.ZY);
