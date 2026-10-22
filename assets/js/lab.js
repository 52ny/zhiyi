/* 知忆 · 知识工坊（解释 / 变式 / 拓展 / 费曼） */
(function (Z) {
  const SUBJECTS = ['自动', '数学', '物理', '化学', '生物', '计算机'];
  const SUBJECT_HINTS = {
    数学: ['函数', '方程', '几何', '三角', '数列', '概率', '向量', '导数', '定理', '不等式', '积分', '矩阵', '集合'],
    物理: ['力', '速度', '加速度', '电场', '磁场', '电路', '能量', '动量', '光', '热', '压强', '运动', '电荷', '波'],
    化学: ['反应', '元素', '化合物', '摩尔', '溶液', '氧化', '酸', '碱', '平衡', '有机', '离子', '化学键'],
    生物: ['细胞', '遗传', '基因', '光合', '呼吸', '生态', '蛋白质', '酶', '神经', '免疫', '种群'],
    计算机: ['算法', '复杂', '数据', '递归', '排序', '树', '图', '网络', '数据库', '进程', '线程', '面向对象', '指针', '缓存', '协议', '复杂度']
  };

  let state = { concept: '', subject: '自动', result: null, source: '', feynman: '' };

  function findLocal(concept, subject) {
    const q = concept.trim().toLowerCase();
    if (!q) return null;
    let best = null, bestScore = 0;
    for (const item of Z.KNOWLEDGE || []) {
      if (subject !== '自动' && item.subject !== subject) continue;
      const names = [item.name, ...(item.aliases || [])].map((x) => x.toLowerCase());
      let score = 0;
      names.forEach((n) => {
        if (n === q) score = Math.max(score, 100);
        else if (n.includes(q) || q.includes(n)) score = Math.max(score, 60 + Math.min(n.length, q.length));
      });
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return bestScore >= 60 ? best : null;
  }

  function guessSubject(concept) {
    let best = '综合', bestScore = 0;
    Object.entries(SUBJECT_HINTS).forEach(([sub, words]) => {
      const hits = words.filter((w) => concept.includes(w)).length;
      if (hits > bestScore) { bestScore = hits; best = sub; }
    });
    return best;
  }

  function generic(concept, subject) {
    return {
      subject: subject === '自动' ? guessSubject(concept) : subject,
      name: concept,
      essence: `先抓住「${concept}」在解决什么问题，再记它的条件与结论。`,
      definition: `「${concept}」是${subject === '自动' ? guessSubject(concept) : subject}中的一个核心知识点。掌握它需要回答四个问题：它描述的对象是什么？在什么条件下成立？核心关系/公式是什么？能解决哪类问题？建议先用自己的话写一遍，再对照教材修正。`,
      intuition: '试着找一个生活中的对应物：它像什么？哪里像、哪里不像？类比能暴露你理解中的缺口。',
      points: ['对象：它研究的是什么（概念、量或过程）', '条件：成立需要哪些前提，边界在哪里', '关系：核心公式、因果链或分类标准', '用途：常见题型与真实场景'],
      formula: ['（在这里写下核心公式、定义式或判定条件）'],
      conditions: ['把教材中的前提逐条列出，特别注意“仅当”“在…条件下”'],
      mistakes: [
        { wrong: '只背结论，不记条件', right: '条件决定适用范围；先判断条件，再套结论' },
        { wrong: '把相似概念混为一谈', right: '做一张对比表：对象、条件、结论、典型例子各写一行' }
      ],
      variants: [
        { q: `如果改变「${concept}」的一个条件，结论会怎样变化？`, hint: '把条件逐条替换为极端值（0、无穷、反向），观察结论是否仍成立。' },
        { q: `把「${concept}」反过来问：已知结论，能否推出条件？`, hint: '尝试寻找逆命题，并判断它是否成立；不成立时找一个反例。' },
        { q: `把「${concept}」与一个相邻知识点组合，会得到什么新问题？`, hint: '组合两个条件，构造一个两步或三步的问题。' }
      ],
      extensions: ['向上抽象：它属于哪个更大的知识框架？', '向下具体：找一个最小例子和一道典型题', '跨学科：它在其他学科或生活中如何出现？'],
      relations: [{ name: '相邻知识点', why: '把相关概念连成图，记忆会更牢固' }],
      quiz: [
        { q: `用一句话说出「${concept}」的本质。`, a: '对照你的答案与定义，检查是否包含对象、条件与结论。' },
        { q: `「${concept}」成立的关键条件是什么？`, a: '回到定义逐条核对，尤其注意限定词。' },
        { q: `举一个「${concept}」的反例或边界情况。`, a: '能举出反例，说明你理解了它的边界。' }
      ]
    };
  }

  function normalizeAI(data, concept, subject) {
    return {
      subject: subject === '自动' ? guessSubject(concept) : subject,
      name: concept,
      essence: data.essence || '',
      definition: data.definition || '',
      intuition: data.intuition || '',
      points: data.points || [],
      formula: data.formula || [],
      conditions: data.conditions || [],
      mistakes: data.mistakes || [],
      variants: data.variants || [],
      extensions: data.extensions || [],
      relations: data.relations || [],
      quiz: data.quiz || [],
      source: data.source || '',
      url: data.url || ''
    };
  }

  function esc(s) { return Z.esc(s); }

  function renderShell() {
    return `<div class="lab">
      <div class="lab-head">
        <div>
          <span class="eyebrow">KNOWLEDGE WORKSHOP</span>
          <h1>把知识点拆开、变形、再长出来</h1>
          <p>输入概念，得到本质、条件、变式与迁移。</p>
        </div>
        <div class="lab-ai ${Z.AI.isReady() ? 'ready' : ''}">
          <span class="dot"></span>${Z.AI.isReady() ? 'AI 增强已开启 · ' + Z.esc(Z.AI.label()) : 'AI 未配置 · 使用内置知识库'}
        </div>
      </div>
      <div class="lab-console">
        <div class="lab-input-row">
          <span class="lab-search-ico" data-ico="search"></span>
          <input id="lab-concept" class="lab-input" placeholder="输入知识点，例如：动量守恒、动态规划、化学平衡…" autocomplete="off">
          <button class="btn primary" id="lab-go"><span data-ico="sparkle"></span>拆解</button>
        </div>
        <div class="lab-subjects">
          ${SUBJECTS.map((s) => `<button class="chip ${s === state.subject ? 'on' : ''}" data-subject="${s}">${s}</button>`).join('')}
          <span class="lab-suggest">试试：<button data-suggest="勾股定理">勾股定理</button><button data-suggest="牛顿第二定律">牛顿第二定律</button><button data-suggest="动态规划">动态规划</button><button data-suggest="化学平衡">化学平衡</button></span>
        </div>
      </div>
      <div id="lab-result" class="lab-result"></div>
    </div>`;
  }

  function mount(container) {
    state = { concept: '', subject: state.subject || '自动', result: null, source: '', feynman: '' };
    container.innerHTML = renderShell();
    Z.hydrateIcons(container);
    renderEmpty();

    container.addEventListener('click', async (e) => {
      const sub = e.target.closest('[data-subject]');
      if (sub) {
        state.subject = sub.dataset.subject;
        Z.$$('[data-subject]', container).forEach((b) => b.classList.toggle('on', b === sub));
        return;
      }
      const sug = e.target.closest('[data-suggest]');
      if (sug) {
        Z.$('#lab-concept', container).value = sug.dataset.suggest;
        run();
        return;
      }
      if (e.target.closest('#lab-go')) { run(); return; }
      const act = e.target.closest('[data-lab]')?.dataset.lab;
      if (!act) return;
      if (act === 'ai') { run(true); return; }
      if (act === 'go-ai') { location.hash = '#/settings'; return; }
      if (act === 'save') { await saveDoc(); return; }
      if (act === 'export') { exportMd(); return; }
      if (act === 'reveal') {
        const box = e.target.closest('.quiz-item');
        box.classList.toggle('open');
        return;
      }
      if (act === 'feynman') { await checkFeynman(); return; }
    });
    container.addEventListener('keydown', (e) => {
      if (e.target.id === 'lab-concept' && e.key === 'Enter') run();
    });
  }

  function renderEmpty() {
    const el = Z.$('#lab-result');
    el.innerHTML = `<div class="lab-empty">
      <div class="method-grid">
        <div class="method-card"><span class="method-no">01</span><h4>拆解</h4><p>对象、条件、结论各说一遍。</p></div>
        <div class="method-card"><span class="method-no">02</span><h4>变形</h4><p>改条件、取极端、求逆命题。</p></div>
        <div class="method-card"><span class="method-no">03</span><h4>迁移</h4><p>找相邻概念与实际场景。</p></div>
        <div class="method-card"><span class="method-no">04</span><h4>费曼</h4><p>讲给外行听，卡住处即缺口。</p></div>
      </div>
      <div class="lab-quote">“记住”不是把话存起来，而是能把它重新长出来。</div>
    </div>`;
  }

  async function run(forceAI) {
    const input = Z.$('#lab-concept');
    const concept = (input.value || '').trim();
    if (!concept) { Z.toast('先输入一个知识点', 'error'); input.focus(); return; }
    state.concept = concept;
    const local = findLocal(concept, state.subject);
    const useAI = forceAI || (Z.AI.isReady() && !local);

    if (useAI && !Z.AI.isReady()) {
      Z.toast('请先在设置中配置 AI 接口', 'error');
      if (!local) return;
    }

    const el = Z.$('#lab-result');
    if (useAI) {
      const label = Z.AI.isOnline() ? '正在检索在线知识库「' + concept + '」' : 'AI 正在拆解「' + concept + '」';
      const busy = Z.busy(label, Z.AI.isOnline() ? '百度百科 · 萌娘百科' : '本质 · 条件 · 变式 · 迁移');
      try {
        const data = await Z.AI.explain(concept, state.subject === '自动' ? guessSubject(concept) : state.subject, '');
        state.result = normalizeAI(data, concept, state.subject);
        state.source = data.source ? '在线知识库 · ' + data.source : 'AI 讲解';
        busy.close();
        renderResult();
        Z.toast('AI 讲解已生成', 'ok');
        return;
      } catch (err) {
        busy.close();
        Z.toast('在线检索失败：' + err.message, 'error', 5000);
      }
    }

    state.result = local ? JSON.parse(JSON.stringify(local)) : generic(concept, state.subject);
    state.source = local ? '内置知识库' : '通用拆解框架';
    if (!local) Z.toast('内置库没有这一条：加载本地模型即可深度拆解任意知识点', 'info', 4000);
    renderResult();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResult() {
    const r = state.result;
    const el = Z.$('#lab-result');
    const mistakes = (r.mistakes || []).map((m) => `<div class="mistake">
      <div class="mis-wrong"><span>误区</span>${esc(m.wrong || m)}</div>
      <div class="mis-right"><span>修正</span>${esc(m.right || '')}</div>
    </div>`).join('');
    const variants = (r.variants || []).map((v, i) => `<details class="variant">
      <summary><span class="vno">变式 ${i + 1}</span>${esc(v.q || v)}</summary>
      <div class="vhint">${esc(v.hint || '')}</div>
    </details>`).join('');
    const quiz = (r.quiz || []).map((q, i) => `<div class="quiz-item" data-lab="reveal">
      <div class="quiz-q"><span>Q${i + 1}</span>${esc(q.q)}</div>
      <div class="quiz-hint">提示：${esc(q.hint || '先想定义与适用条件，再落到结论。')}</div>
      <div class="quiz-a"><div>${esc(q.a)}</div></div>
    </div>`).join('');

    el.innerHTML = `<article class="lab-result-card">
      ${state.source === '通用拆解框架' ? `<div class="ai-cta">
        <div><strong>这只是通用模板</strong><span>没有检索到该知识点。可换个说法再试，或在设置中切换本地模型 / 云端接口获得生成式讲解。</span></div>
        <button class="btn primary small" data-lab="go-ai">去设置</button>
      </div>` : ''}
      <header class="lab-hero">
        <div class="lh-tag">${esc(r.subject || '综合')} · ${esc(state.source)}</div>
        <h2>${esc(r.name)}</h2>
        <p class="lh-essence">${esc(r.essence)}</p>
        ${r.url ? `<a class="src-link" href="${esc(r.url)}" target="_blank" rel="noopener">来源：${esc(r.source || '在线知识库')} ↗</a>` : ''}
        <div class="lh-actions">
          <button class="btn primary small" data-lab="save"><span data-ico="book"></span>保存到文库</button>
          <button class="btn ghost small" data-lab="export"><span data-ico="download"></span>导出笔记</button>
          <button class="btn ghost small" data-lab="ai"><span data-ico="sparkle"></span>AI 换个角度</button>
        </div>
      </header>

      <div class="lab-duo">
        <section class="lab-block"><h4><span>01</span>定义拆解</h4><p>${esc(r.definition)}</p></section>
        <section class="lab-block"><h4><span>02</span>直观理解</h4><p>${esc(r.intuition)}</p></section>
      </div>

      ${r.points?.length ? `<section class="lab-block"><h4><span>03</span>关键要点</h4><ul class="lab-points">${r.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}

      <div class="lab-duo">
        <section class="lab-block"><h4><span>04</span>公式与表达</h4>
          ${r.formula?.length
            ? `<div class="formula-list">${r.formula.map((f) => `<code>${esc(f)}</code>`).join('')}</div>`
            : '<p class="muted small">该知识点没有统一公式，重点记忆定义、条件与判定关系。</p>'}
        </section>
        <section class="lab-block"><h4><span>05</span>适用条件</h4>${r.conditions?.length ? `<ul class="cond-list">${r.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p class="muted small">暂无。</p>'}</section>
      </div>

      ${mistakes ? `<section class="lab-block"><h4><span>06</span>常见误区</h4><div class="mistake-grid">${mistakes}</div></section>` : ''}

      ${variants ? `<section class="lab-block"><h4><span>07</span>主动变形</h4><div class="variant-list">${variants}</div></section>` : ''}

      ${r.extensions?.length ? `<section class="lab-block"><h4><span>08</span>拓展延伸</h4><ul class="ext-list">${r.extensions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}

      ${r.relations?.length ? `<section class="lab-block"><h4><span>09</span>相关概念</h4><div class="rel-list">${r.relations.map((x) => `<div class="rel"><strong>${esc(x.name)}</strong><span>${esc(x.why)}</span></div>`).join('')}</div></section>` : ''}

      ${quiz ? `<section class="lab-block"><h4><span>10</span>自测 · 点击揭晓</h4><div class="quiz-list">${quiz}</div></section>` : ''}

      <section class="lab-block feynman">
        <h4><span>11</span>费曼自检</h4>
        <p class="muted small">用自己的话讲一遍，再自检缺口。</p>
        <textarea class="input area" id="feynman-input" rows="5" placeholder="我这样理解「${esc(r.name)}」…">${esc(state.feynman)}</textarea>
        <div class="feynman-actions">
          <button class="btn primary small" data-lab="feynman"><span data-ico="sparkle"></span>${Z.AI.isChat() ? 'AI 点评我的解释' : '自检我的解释'}</button>
        </div>
        <div id="feynman-out"></div>
      </section>
    </article>`;
    Z.hydrateIcons(el);
    const ta = Z.$('#feynman-input', el);
    ta.addEventListener('input', () => { state.feynman = ta.value; });
    if (state.feynmanFeedback) renderFeynmanFeedback(state.feynmanFeedback);
  }

  async function checkFeynman() {
    const ta = Z.$('#feynman-input');
    const text = (ta.value || '').trim();
    if (text.length < 20) { Z.toast('至少写一两句话，才能看出理解程度', 'error'); return; }
    state.feynman = text;
    const r = state.result;
    const out = Z.$('#feynman-out');

    if (Z.AI.isChat()) {
      out.innerHTML = `<div class="fb-loading"><span class="spinner small"></span> AI 正在阅读你的解释…</div>`;
      try {
        const fb = await Z.AI.feynman(r.name, text);
        state.feynmanFeedback = { ai: true, ...fb };
        renderFeynmanFeedback(state.feynmanFeedback);
        return;
      } catch (e) {
        Z.toast('AI 点评失败，已切换为自检清单：' + e.message, 'error');
      }
    }

    const keyTerms = [];
    [r.name, ...(r.points || []), ...(r.formula || [])].join(' ').replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, ' ').split(/\s+/).forEach((w) => {
      if (w.length >= 2 && w.length <= 8 && !/^(的|了|是|在|和|与|及|或|一个|我们|可以)$/.test(w)) keyTerms.push(w);
    });
    const uniq = Array.from(new Set(keyTerms)).slice(0, 12);
    const hit = uniq.filter((w) => text.includes(w));
    const hasCondition = /条件|前提|当|若|只有|除非/.test(text);
    const hasCause = /因为|所以|因此|由于|导致/.test(text);
    const hasExample = /例如|比如|举例|想象|就像|类似/.test(text);
    let score = 30 + Math.min(30, Math.floor(text.length / 8)) + Math.min(20, hit.length * 4) + (hasCondition ? 6 : 0) + (hasCause ? 6 : 0) + (hasExample ? 8 : 0);
    score = Z.clamp(score, 30, 95);
    const gaps = [];
    if (!hasCondition) gaps.push('没有说明适用条件，容易把结论用在不该用的地方。');
    if (!hasCause) gaps.push('缺少因果链，建议补上“为什么成立”。');
    if (!hasExample) gaps.push('没有例子或类比，记忆锚点偏少。');
    if (!hit.length) gaps.push('没有出现核心术语，检查是否偏离了主题。');
    if (text.length < 60) gaps.push('解释偏短，试着讲给一个完全没学过的人听。');
    const kept = [];
    if (hit.length) kept.push('提到了核心术语：' + hit.slice(0, 5).join('、'));
    if (hasCondition) kept.push('注意到了适用条件。');
    if (hasCause) kept.push('有因果解释。');
    state.feynmanFeedback = {
      ai: false, score, kept,
      gaps: gaps.length ? gaps : ['整体表达较完整，可以再检查边界情况。'],
      fix: ['把“对象—条件—结论—例子”四句话补齐，再复述一次。', '找一个反例，检验你的条件是否写全。'],
      question: `如果改变「${r.name}」的一个前提，结论还成立吗？为什么？`
    };
    renderFeynmanFeedback(state.feynmanFeedback);
  }

  function renderFeynmanFeedback(fb) {
    const out = Z.$('#feynman-out');
    if (!out) return;
    out.innerHTML = `<div class="fb-card">
      <div class="fb-head">
        <div class="fb-score"><strong>${fb.score ?? '—'}</strong><span>${fb.ai ? 'AI 评估' : '自检分'}</span></div>
        <div class="fb-sum">${fb.ai ? 'AI 已阅读你的解释，下面是具体反馈。' : '这是基于清单的快速自检，重点看“缺什么”。'}</div>
      </div>
      ${fb.kept?.length ? `<div class="fb-row"><span class="fb-tag ok">讲对了</span><ul>${fb.kept.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${fb.gaps?.length ? `<div class="fb-row"><span class="fb-tag warn">有缺口</span><ul>${fb.gaps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${fb.fix?.length ? `<div class="fb-row"><span class="fb-tag tip">怎么改</span><ul>${fb.fix.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${fb.question ? `<div class="fb-question"><span>追问</span>${esc(fb.question)}</div>` : ''}
    </div>`;
  }

  function toBlocks(r) {
    const blocks = [];
    const add = (t, text) => { if (text) blocks.push({ t, text: String(text) }); };
    add('h1', r.name);
    add('p', r.essence);
    add('h2', '一句话本质');
    add('p', r.essence);
    add('h2', '定义拆解');
    add('p', r.definition);
    add('h2', '直观理解');
    add('p', r.intuition);
    if (r.points?.length) {
      add('h2', '关键要点');
      r.points.forEach((p) => add('li', p));
    }
    if (r.formula?.length || r.conditions?.length) {
      add('h2', '公式与条件');
      (r.formula || []).forEach((f) => add('li', '公式：' + f));
      (r.conditions || []).forEach((c) => add('li', '条件：' + c));
    }
    if (r.mistakes?.length) {
      add('h2', '常见误区');
      r.mistakes.forEach((m) => add('p', `误区：${m.wrong}　修正：${m.right}`));
    }
    if (r.variants?.length) {
      add('h2', '变式与拓展');
      r.variants.forEach((v, i) => { add('li', `变式 ${i + 1}：${v.q}`); if (v.hint) add('li', '思路：' + v.hint); });
      (r.extensions || []).forEach((x) => add('li', x));
    }
    if (r.relations?.length) {
      add('h2', '相关概念');
      r.relations.forEach((rel) => add('li', `${rel.name}：${rel.why}`));
    }
    if (r.quiz?.length) {
      add('h2', '自测');
      r.quiz.forEach((q, i) => add('li', `Q${i + 1}：${q.q}　答：${q.a}`));
    }
    return blocks;
  }

  async function saveDoc() {
    if (!state.result) return;
    const r = state.result;
    const doc = Z.Import.makeDoc({
      title: r.name,
      type: 'knowledge',
      source: 'concept',
      lang: 'zh',
      blocks: toBlocks(r),
      journal: state.feynman ? '我的费曼解释：\n' + state.feynman : ''
    });
    Z.Import.finishDoc(doc, { forceType: 'knowledge' });
    doc.cards = [];
    (r.quiz || []).forEach((q) => doc.cards.push({
      id: Z.uid('card'), kind: 'qa', front: q.q, back: q.a,
      due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now()
    }));
    (r.formula || []).forEach((f) => doc.cards.push({
      id: Z.uid('card'), kind: 'qa', front: `写出「${r.name}」中的公式/表达式`, back: f,
      due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now()
    }));
    (r.mistakes || []).slice(0, 3).forEach((m) => doc.cards.push({
      id: Z.uid('card'), kind: 'qa', front: `常见误区：${m.wrong}。正确理解是？`, back: m.right,
      due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now()
    }));
    await Z.DB.putDoc(doc);
    Z.toast('已保存到文库，并附带复习卡片', 'ok');
    location.hash = '#/doc/' + doc.id;
  }

  function exportMd() {
    if (!state.result) return;
    const r = state.result;
    const lines = [];
    lines.push(`# ${r.name}`, '', `> ${r.essence}`, '', '## 定义', r.definition, '', '## 直观理解', r.intuition, '');
    if (r.points?.length) lines.push('## 关键要点', ...r.points.map((x) => '- ' + x), '');
    if (r.formula?.length) lines.push('## 公式', ...r.formula.map((x) => '- `' + x + '`'), '');
    if (r.conditions?.length) lines.push('## 适用条件', ...r.conditions.map((x) => '- ' + x), '');
    if (r.mistakes?.length) lines.push('## 常见误区', ...r.mistakes.map((m) => `- 误区：${m.wrong}\n  - 修正：${m.right}`), '');
    if (r.variants?.length) lines.push('## 变式', ...r.variants.map((v, i) => `- 变式 ${i + 1}：${v.q}\n  - 提示：${v.hint}`), '');
    if (r.extensions?.length) lines.push('## 拓展', ...r.extensions.map((x) => '- ' + x), '');
    if (r.relations?.length) lines.push('## 相关概念', ...r.relations.map((x) => `- **${x.name}**：${x.why}`), '');
    if (r.quiz?.length) lines.push('## 自测', ...r.quiz.map((q, i) => `${i + 1}. ${q.q}\n   - 答：${q.a}`), '');
    if (state.feynman) lines.push('', '## 我的费曼解释', state.feynman);
    Z.download(`${r.name}-知识笔记.md`, lines.join('\n'), 'text/markdown');
  }

  Z.Lab = { mount };
})(window.ZY);
