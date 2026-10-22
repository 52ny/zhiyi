/* 知忆 · 思维导图（生成 / 编辑 / 导出） */
(function (Z) {
  const PALETTE = [
    { fill: '#e7f2ee', stroke: '#2f7c6a', text: '#17493e' },
    { fill: '#fdf0dc', stroke: '#c47a1c', text: '#6b3f05' },
    { fill: '#e9eefb', stroke: '#4a6cc4', text: '#223a78' },
    { fill: '#fbe9ec', stroke: '#b95065', text: '#6d2334' },
    { fill: '#f2ecfa', stroke: '#7a58b3', text: '#402a6b' },
    { fill: '#eef4e4', stroke: '#6b8f2f', text: '#334d0f' }
  ];
  const NODE_W = 176, ROOT_W = 196, GAP_X = 236, GAP_Y = 14;
  let ctx = null;

  function newId() { return Z.uid('n'); }

  function normalize(node) {
    if (!node) return null;
    node.children = Array.isArray(node.children) ? node.children.map(normalize).filter(Boolean) : [];
    if (!node.id) node.id = newId();
    node.text = String(node.text || '');
    return node;
  }

  function buildFromBlocks(doc) {
    const root = { id: newId(), text: Z.truncate(doc.title || '主题', 16), children: [] };
    const heads = doc.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.t && x.b.t[0] === 'h');
    if (heads.length) {
      const stack = [{ level: 0, node: root }];
      doc.blocks.forEach((b, i) => {
        if (!b.text) return;
        const lv = b.t[0] === 'h' ? Number(b.t[1] || 2) : 0;
        if (lv) {
          while (stack.length > 1 && stack[stack.length - 1].level >= lv) stack.pop();
          const parent = stack[stack.length - 1].node;
          const n = { id: newId(), text: Z.truncate(b.text, 20), children: [], block: i };
          parent.children.push(n);
          stack.push({ level: lv, node: n });
        } else {
          const parent = stack[stack.length - 1].node;
          if (parent.children.length >= 7) return;
          const text = b.text.trim();
          if (b.t === 'li') {
            parent.children.push({ id: newId(), text: Z.truncate(text, 26), children: [], block: i });
          } else if (text.length > 8) {
            const sentences = Z.splitSentences(text);
            const n = { id: newId(), text: Z.truncate(sentences[0] || text, 26), children: [], block: i };
            if (sentences.length > 1 && parent.children.length < 5) {
              sentences.slice(1, 3).forEach((s) => n.children.push({ id: newId(), text: Z.truncate(s, 28), children: [], block: i }));
            }
            parent.children.push(n);
          }
        }
      });
    } else {
      // 无标题：按段落/句子拆成结构
      const paras = doc.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.text && x.b.text.length > 4);
      const groupCount = Z.clamp(Math.ceil(paras.length / 5), 2, 6);
      const per = Math.ceil(paras.length / groupCount);
      for (let g = 0; g < groupCount && g * per < paras.length; g++) {
        const slice = paras.slice(g * per, (g + 1) * per);
        if (!slice.length) continue;
        const first = slice[0];
        const branch = {
          id: newId(), block: first.i,
          text: Z.truncate(Z.splitSentences(first.b.text)[0] || first.b.text, 24),
          children: []
        };
        slice.slice(1).forEach((x) => {
          const ss = Z.splitSentences(x.b.text);
          branch.children.push({ id: newId(), text: Z.truncate(ss[0] || x.b.text, 28), children: [], block: x.i });
          if (ss.length > 1 && branch.children.length < 5) {
            branch.children.push({ id: newId(), text: Z.truncate(ss[1], 28), children: [], block: x.i });
          }
        });
        root.children.push(branch);
      }
    }

    // 控制体量
    let count = 0;
    (function trim(n, depth) {
      n.children = n.children.slice(0, depth === 1 ? 6 : 5);
      n.children.forEach((c) => trim(c, depth + 1));
      count++;
    })(root, 0);
    if (count > 60) {
      root.children = root.children.slice(0, 6);
      root.children.forEach((c) => { c.children = c.children.slice(0, 4); });
    }
    if (!root.children.length) {
      root.children = [
        { id: newId(), text: '核心概念', children: [] },
        { id: newId(), text: '关键要点', children: [] },
        { id: newId(), text: '应用与练习', children: [] }
      ];
    }
    return root;
  }

  function fromAITree(tree) {
    function walk(t, depth) {
      return {
        id: newId(),
        text: Z.truncate(String(t.text || t.root || '节点'), depth === 0 ? 16 : 24),
        children: (t.children || []).map((c) => walk(c, depth + 1))
      };
    }
    const root = walk({ text: tree.root || '主题', children: tree.children || [] }, 0);
    normalize(root);
    return root;
  }

  function ensureTree(doc) {
    if (!doc.mindmap || !doc.mindmap.root || !doc.mindmap.root.children) {
      doc.mindmap = { root: buildFromBlocks(doc) };
    }
    return normalize(doc.mindmap.root);
  }

  function mount(container, doc, opts = {}) {
    const root = ensureTree(doc);
    ctx = {
      container, doc, root,
      save: opts.onChange || (() => {}),
      onJump: opts.onJump || (() => {}),
      selected: root.id,
      collapsed: new Set(doc.mindmap.collapsed || []),
      revealed: new Set(),
      recall: false,
      view: { x: 0, y: 0, k: 1 },
      dragging: null,
      layout: null,
      measure: document.createElement('canvas').getContext('2d')
    };
    container.innerHTML = `<div class="mindmap-wrap">
      <div class="mm-toolbar">
        <div class="mm-group">
          <button class="btn ghost small" data-mm="regen"><span data-ico="refresh"></span>重新生成</button>
          <button class="btn ghost small" data-mm="ai"><span data-ico="sparkle"></span>AI 生成</button>
        </div>
        <div class="mm-group">
          <button class="btn ghost small" data-mm="add-child"><span data-ico="plus"></span>子节点</button>
          <button class="btn ghost small" data-mm="add-sibling">同级</button>
          <button class="btn ghost small" data-mm="edit"><span data-ico="edit"></span>改名</button>
          <button class="btn ghost small" data-mm="del"><span data-ico="trash"></span></button>
        </div>
        <div class="mm-group">
          <button class="btn ghost small" data-mm="recall"><span data-ico="eye"></span>回忆模式</button>
          <button class="btn ghost small" data-mm="jump" title="定位原文"><span data-ico="book"></span></button>
          <button class="btn ghost small" data-mm="fit"><span data-ico="expand"></span>适应</button>
          <button class="btn ghost small" data-mm="export-svg"><span data-ico="download"></span>SVG</button>
          <button class="btn ghost small" data-mm="export-png"><span data-ico="image"></span>PNG</button>
        </div>
      </div>
      <div class="mm-canvas" id="mm-canvas">
        <svg xmlns="http://www.w3.org/2000/svg" id="mm-svg"></svg>
        <div class="mm-detail" id="mm-detail" hidden></div>
        <div class="mm-hint">点击节点看原文 · 双击改名 · 滚轮缩放</div>
      </div>
    </div>`;
    Z.hydrateIcons(container);
    renderSvg();
    resetView();
    bind();
    const onKey = (e) => { if (e.key === 'Escape') hideDetail(); };
    document.addEventListener('keydown', onKey);
    return { destroy() { document.removeEventListener('keydown', onKey); } };
  }

  function visibleChildren(n) {
    if (ctx.collapsed.has(n.id)) return [];
    return n.children || [];
  }

  function listNodes() {
    const out = [];
    (function walk(n, depth, branch) {
      out.push({ node: n, depth, branch });
      visibleChildren(n).forEach((c, i) => walk(c, depth + 1, depth === 0 ? i : branch));
    })(ctx.root, 0, 0);
    return out;
  }

  function colorOf(depth, branch) {
    if (depth === 0) return { fill: '#176b5b', stroke: '#0f4d41', text: '#ffffff' };
    return PALETTE[(branch || 0) % PALETTE.length];
  }

  function wrapText(text, maxWidth, font) {
    ctx.measure.font = font;
    const lines = [];
    let line = '';
    const tokens = /[\u4e00-\u9fff]/.test(text) ? Array.from(text) : text.split(/(\s+)/);
    for (const tk of tokens) {
      const test = line + tk;
      if (ctx.measure.measureText(test).width > maxWidth && line) {
        lines.push(line.trim());
        line = tk.trim() ? tk : '';
        if (lines.length >= 2) break;
      } else line = test;
    }
    if (line && lines.length < 2) lines.push(line.trim());
    if (lines.length === 2 && tokens.join('').length > lines.join('').length) {
      lines[1] = lines[1].slice(0, Math.max(1, lines[1].length - 1)) + '…';
    }
    return lines.length ? lines : [''];
  }

  function layout() {
    const nodes = listNodes();
    const font = '12px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    const rootFont = '13px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    nodes.forEach((x) => {
      const w = x.depth === 0 ? ROOT_W : NODE_W;
      x.w = w;
      x.lines = wrapText(x.node.text || '', w - 24, x.depth === 0 ? rootFont : font);
      x.h = x.lines.length * 17 + 18;
    });
    let cursor = 0;
    const itemMap = new Map(nodes.map((x) => [x.node.id, x]));
    function calc(item) {
      const kids = visibleChildren(item.node).map((c) => itemMap.get(c.id)).filter(Boolean);
      item.x = 40 + item.depth * GAP_X + (item.node._ox || 0);
      if (!kids.length) {
        item.y = cursor + (item.node._oy || 0);
        cursor += item.h + GAP_Y;
      } else {
        kids.forEach(calc);
        const first = kids[0], last = kids[kids.length - 1];
        item.y = (first.y + last.y + last.h) / 2 - item.h / 2 + (item.node._oy || 0);
        if (item.y < first.y) item.y = first.y;
      }
    }
    calc(itemMap.get(ctx.root.id));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    ctx.layout = { nodes, itemMap, bounds: { minX: 0, minY, maxX, maxY } };
    return ctx.layout;
  }

  function findItem(nodes, node) { return nodes.find((x) => x.node === node); }

  /* ---------- 节点详情：直接在导图内看原文 ---------- */
  function detailText(node) {
    const doc = ctx.doc;
    const blocks = (doc.blocks || []).filter((b) => b.text);
    const i = node.block;
    if (i != null && doc.blocks[i]) {
      const b = doc.blocks[i];
      const parts = [b.text];
      // 标题节点：把紧随其后的正文一起带出，避免只看到一行标题
      if (b.t && b.t[0] === 'h') {
        for (let k = i + 1; k < doc.blocks.length && parts.length < 4; k++) {
          const nb = doc.blocks[k];
          if (!nb.text) continue;
          if (nb.t && nb.t[0] === 'h') break;
          parts.push(nb.text);
        }
      }
      return { main: parts.join('\n'), trans: doc.translations?.[i] || '' };
    }
    // 总概节点：聚合资料的开头与标题，给出可读的整体框架
    const heads = blocks.filter((b) => b.t && b.t[0] === 'h').slice(0, 6).map((b) => '· ' + b.text);
    const paras = blocks.filter((b) => b.t !== 'h').slice(0, 3).map((b) => b.text);
    const text = [doc.title, ...heads, ...paras].filter(Boolean).join('\n');
    return { main: text || '这份资料还没有可展示的正文。', trans: '' };
  }

  function showDetail(node) {
    const box = Z.$('#mm-detail', ctx.container);
    if (!box || !node) return;
    const info = detailText(node);
    const isRoot = node.block == null;
    box.hidden = false;
    box.innerHTML = `<div class="mmd-head">
        <span class="mmd-tag">${isRoot ? '总概' : '原文'}</span>
        <strong>${Z.esc(Z.truncate(node.text, 40))}</strong>
        <button class="ghost-icon tiny" data-mm-detail="close">${Z.icon('close')}</button>
      </div>
      <div class="mmd-body">${Z.esc(info.main)}</div>
      ${info.trans ? `<div class="mmd-trans">${Z.esc(info.trans)}</div>` : ''}
      <div class="mmd-foot">
        ${isRoot ? '' : '<button class="btn ghost small" data-mm-detail="jump">定位原文</button>'}
        <button class="btn ghost small" data-mm-detail="speak">${Z.icon('volume')}朗读</button>
        <span class="mmd-hint">${isRoot ? '点击分支节点可看对应段落' : '来自导入原文，可继续在阅读页批注'}</span>
      </div>`;
    Z.hydrateIcons(box);
    ctx.detailNode = node;
  }

  function hideDetail() {
    const box = Z.$('#mm-detail', ctx.container);
    if (box) box.hidden = true;
    ctx.detailNode = null;
  }

  function handleDetail(act) {
    const node = ctx.detailNode;
    if (act === 'close') { hideDetail(); return; }
    if (!node) return;
    if (act === 'jump' && node.block != null) { ctx.onJump(node.block); return; }
    if (act === 'speak') {
      const info = detailText(node);
      Z.TTS.speak(info.trans || info.main, { lang: ctx.doc.lang });
    }
  }


  function renderSvg() {
    const svg = Z.$('#mm-svg', ctx.container);
    if (!svg) return;
    const L = layout();
    const { nodes, itemMap } = L;
    const font = '12px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    let links = '';
    nodes.forEach((x) => {
      visibleChildren(x.node).forEach((c) => {
        const child = itemMap.get(c.id);
        if (!child) return;
        const x1 = x.x + x.w, y1 = x.y + x.h / 2;
        const x2 = child.x, y2 = child.y + child.h / 2;
        const mx = (x1 + x2) / 2;
        links += `<path class="mm-link" d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="${colorOf(x.depth, x.branch).stroke}" stroke-opacity=".45" fill="none" stroke-width="1.6"/>`;
      });
    });
    let nodeHtml = '';
    nodes.forEach((x) => {
      const c = colorOf(x.depth, x.branch);
      const sel = ctx.selected === x.node.id;
      const hasKids = (x.node.children || []).length > 0;
      const collapsed = ctx.collapsed.has(x.node.id);
      const blind = ctx.recall && x.depth >= 2 && !ctx.revealed.has(x.node.id) && !sel;
      const textFill = blind ? 'transparent' : c.text;
      nodeHtml += `<g class="mm-node ${sel ? 'selected' : ''} ${blind ? 'blind' : ''}" data-id="${x.node.id}" data-depth="${x.depth}" transform="translate(${x.x},${x.y})">
        <rect width="${x.w}" height="${x.h}" rx="9" fill="${c.fill}" stroke="${sel ? '#176b5b' : c.stroke}" stroke-width="${sel ? 2.2 : 1.2}" ${blind ? 'opacity=".92"' : ''}/>
        ${x.lines.map((line, k) => `<text x="12" y="${17 + k * 17}" font-size="${x.depth === 0 ? 13 : 12}" font-weight="${x.depth === 0 ? 600 : 500}" font-family="${font}" fill="${textFill}">${Z.esc(line)}</text>`).join('')}
        ${hasKids ? `<g class="mm-toggle" data-toggle="${x.node.id}" transform="translate(${x.w},${x.h / 2})"><circle r="7.5" fill="#fff" stroke="${c.stroke}" stroke-width="1.2"/><path d="${collapsed ? 'M-3 0h6M0 -3v6' : 'M-3 0h6'}" stroke="${c.stroke}" stroke-width="1.4" stroke-linecap="round"/></g>` : ''}
        ${blind ? `<circle cx="${x.w - 9}" cy="9" r="3" fill="${c.stroke}" opacity=".5"/>` : ''}
      </g>`;
    });
    const b = L.bounds;
    // viewBox 与画布像素一致，缩放只由 transform 控制，避免内容被二次缩小
    const vw = svg.clientWidth || svg.parentElement?.clientWidth || 900;
    const vh = svg.clientHeight || svg.parentElement?.clientHeight || 560;
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, vw)} ${Math.max(1, vh)}`);
    svg.innerHTML = `<g id="mm-stage" transform="translate(${ctx.view.x},${ctx.view.y}) scale(${ctx.view.k})">${links}${nodeHtml}</g>`;
  }

  function resetView() {
    const svg = Z.$('#mm-svg', ctx.container);
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const b = ctx.layout?.bounds || { minX: 0, maxX: 800, maxY: 600, minY: 0 };
    const k = 0.9;
    ctx.view = { k, x: 24, y: Math.max(16, (box.height - (b.maxY - b.minY) * k) / 2 - b.minY * k) };
    renderSvg();
  }

  function fit() {
    const svg = Z.$('#mm-svg', ctx.container);
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const b = ctx.layout?.bounds || { minX: 0, maxX: 800, maxY: 600, minY: 0 };
    const k = Z.clamp(Math.min((box.width - 48) / Math.max(320, b.maxX - b.minX + 40), (box.height - 48) / Math.max(220, b.maxY - b.minY + 40)), 0.4, 1.1);
    ctx.view = { k, x: 24 - b.minX * k, y: Math.max(16, (box.height - (b.maxY - b.minY) * k) / 2 - b.minY * k) };
    renderSvg();
  }

  function bind() {
    const root = ctx.container;
    root.addEventListener('click', (e) => {
      const dact = e.target.closest('[data-mm-detail]')?.dataset.mmDetail;
      if (dact) { handleDetail(dact); return; }
      const act = e.target.closest('[data-mm]')?.dataset.mm;
      if (act) { action(act); return; }
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        const id = toggle.dataset.toggle;
        if (ctx.collapsed.has(id)) ctx.collapsed.delete(id); else ctx.collapsed.add(id);
        ctx.doc.mindmap.collapsed = Array.from(ctx.collapsed);
        ctx.save(ctx.doc);
        renderSvg();
        return;
      }
      const nodeEl = e.target.closest('.mm-node');
      if (nodeEl) {
        const id = nodeEl.dataset.id;
        const node = findNode(id);
        if (ctx.recall && Number(nodeEl.dataset.depth) >= 2) {
          ctx.revealed.add(id);
          ctx.selected = id;
          renderSvg();
          showDetail(node);
          return;
        }
        ctx.selected = id;
        renderSvg();
        showDetail(node);
        return;
      }
    });

    root.addEventListener('dblclick', (e) => {
      const nodeEl = e.target.closest('.mm-node');
      if (nodeEl) { ctx.selected = nodeEl.dataset.id; editNode(); }
    });

    let panStart = null;
    root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-toggle]')) return;
      const nodeEl = e.target.closest('.mm-node');
      if (nodeEl && e.button === 0) {
        const node = findNode(nodeEl.dataset.id);
        ctx.dragging = { node, sx: e.clientX, sy: e.clientY, ox: node._ox || 0, oy: node._oy || 0, moved: false };
        e.target.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      } else if (!e.target.closest('.mm-toolbar')) {
        panStart = { sx: e.clientX, sy: e.clientY, vx: ctx.view.x, vy: ctx.view.y };
      }
    });
    root.addEventListener('pointermove', (e) => {
      if (ctx.dragging) {
        const d = ctx.dragging;
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        d.node._ox = d.ox + dx / ctx.view.k;
        d.node._oy = d.oy + dy / ctx.view.k;
        if (d.moved) renderSvg();
      } else if (panStart) {
        ctx.view.x = panStart.vx + (e.clientX - panStart.sx);
        ctx.view.y = panStart.vy + (e.clientY - panStart.sy);
        renderSvg();
      }
    });
    root.addEventListener('pointerup', (e) => {
      if (ctx.dragging?.moved) {
        ctx.doc.mindmap.offsets = ctx.doc.mindmap.offsets || {};
        ctx.save(ctx.doc);
      }
      ctx.dragging = null;
      panStart = null;
    });
    root.addEventListener('wheel', (e) => {
      if (!e.target.closest('#mm-canvas')) return;
      e.preventDefault();
      const svg = Z.$('#mm-svg', ctx.container);
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const k2 = Z.clamp(ctx.view.k * factor, 0.25, 2.6);
      const ratio = k2 / ctx.view.k;
      ctx.view.x = mx - (mx - ctx.view.x) * ratio;
      ctx.view.y = my - (my - ctx.view.y) * ratio;
      ctx.view.k = k2;
      renderSvg();
    }, { passive: false });
  }

  function findNode(id, node = ctx.root) {
    if (node.id === id) return node;
    for (const c of node.children || []) {
      const hit = findNode(id, c);
      if (hit) return hit;
    }
    return null;
  }

  function findParent(id, node = ctx.root) {
    for (const c of node.children || []) {
      if (c.id === id) return node;
      const hit = findParent(id, c);
      if (hit) return hit;
    }
    return null;
  }

  async function action(act) {
    if (act === 'regen') {
      if (!(await Z.confirm('将根据当前资料重新生成思维导图，手动修改会被覆盖。', { ok: '重新生成' }))) return;
      ctx.doc.mindmap = { root: buildFromBlocks(ctx.doc) };
      ctx.root = normalize(ctx.doc.mindmap.root);
      ctx.collapsed.clear(); ctx.selected = ctx.root.id;
      ctx.save(ctx.doc);
      renderSvg(); fit();
      Z.toast('已重新生成导图', 'ok');
      return;
    }
    if (act === 'ai') {
      if (!Z.AI.isChat()) {
        Z.toast('AI 导图需要本地模型或云端接口；在线知识库只用于知识点拆解', 'error');
        location.hash = '#/settings';
        return;
      }
      const b = Z.busy('AI 正在梳理结构…', '把资料整理成思维导图');
      try {
        const text = ctx.doc.blocks.map((x) => x.text).join('\n').slice(0, 7000);
        const tree = await Z.AI.mindmap(text, ctx.doc.title);
        ctx.doc.mindmap = { root: fromAITree(tree) };
        ctx.root = normalize(ctx.doc.mindmap.root);
        ctx.collapsed.clear(); ctx.selected = ctx.root.id;
        ctx.save(ctx.doc);
        b.close(); renderSvg(); fit();
        Z.toast('AI 导图已生成', 'ok');
      } catch (e) { b.close(); Z.toast('生成失败：' + e.message, 'error'); }
      return;
    }
    if (act === 'add-child' || act === 'add-sibling') {
      const node = findNode(ctx.selected) || ctx.root;
      const text = await Z.promptText(act === 'add-child' ? '添加子节点' : '添加同级节点', '');
      if (!text) return;
      const n = { id: newId(), text, children: [] };
      if (act === 'add-child') {
        node.children.push(n);
        ctx.collapsed.delete(node.id);
      } else {
        const p = findParent(node.id) || ctx.root;
        p.children.push(n);
      }
      ctx.selected = n.id;
      ctx.save(ctx.doc); renderSvg();
      return;
    }
    if (act === 'edit') { editNode(); return; }
    if (act === 'del') {
      const node = findNode(ctx.selected);
      if (!node || node === ctx.root) { Z.toast('根节点不能删除', 'error'); return; }
      if (!(await Z.confirm('删除该节点及其子节点？', { danger: true, ok: '删除' }))) return;
      const p = findParent(node.id);
      p.children = p.children.filter((c) => c !== node);
      ctx.selected = p.id;
      ctx.save(ctx.doc); renderSvg();
      return;
    }
    if (act === 'recall') {
      ctx.recall = !ctx.recall;
      ctx.revealed.clear();
      Z.$('[data-mm="recall"]', ctx.container)?.classList.toggle('on', ctx.recall);
      renderSvg();
      Z.toast(ctx.recall ? '回忆模式：遮住深层节点，先回想再点击揭示' : '已退出回忆模式', 'ok');
      return;
    }
    if (act === 'jump') {
      const node = findNode(ctx.selected);
      if (node && node.block != null) ctx.onJump(node.block);
      else Z.toast('该节点没有关联原文', 'info');
      return;
    }
    if (act === 'fit') { fit(); return; }
    if (act === 'export-svg') { exportSvg(); return; }
    if (act === 'export-png') { exportPng(); return; }
  }

  async function editNode() {
    const node = findNode(ctx.selected);
    if (!node) return;
    const text = await Z.promptText('编辑节点', node.text, { rows: 2 });
    if (text == null) return;
    node.text = text;
    ctx.save(ctx.doc);
    renderSvg();
  }

  function exportMarkup() {
    const L = layout();
    const nodes = L.nodes;
    const itemMap = L.itemMap;
    const b = L.bounds;
    const pad = 40;
    let links = '', nodeHtml = '';
    nodes.forEach((x) => {
      visibleChildren(x.node).forEach((c) => {
        const child = itemMap.get(c.id);
        if (!child) return;
        const x1 = x.x + x.w, y1 = x.y + x.h / 2, x2 = child.x, y2 = child.y + child.h / 2;
        const mx = (x1 + x2) / 2;
        links += `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" stroke="${colorOf(x.depth, x.branch).stroke}" stroke-opacity=".45" fill="none" stroke-width="1.6"/>`;
      });
    });
    nodes.forEach((x) => {
      const c = colorOf(x.depth, x.branch);
      nodeHtml += `<g transform="translate(${x.x},${x.y})">
        <rect width="${x.w}" height="${x.h}" rx="9" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>
        ${x.lines.map((line, k) => `<text x="12" y="${17 + k * 17}" font-size="${x.depth === 0 ? 13 : 12}" font-weight="${x.depth === 0 ? 600 : 500}" font-family="PingFang SC, Microsoft YaHei, sans-serif" fill="${c.text}">${Z.esc(line)}</text>`).join('')}
      </g>`;
    });
    const w = Math.max(1, b.maxX + pad * 2), h = Math.max(1, b.maxY - b.minY + pad * 2);
    return {
      w: Math.round(w), h: Math.round(h),
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 ${b.minY - pad} ${Math.round(w)} ${Math.round(h)}">
        <rect x="0" y="${b.minY - pad}" width="${Math.round(w)}" height="${Math.round(h)}" fill="#fbfaf6"/>
        <g transform="translate(${pad},0)">${links}${nodeHtml}</g>
      </svg>`
    };
  }

  function exportSvg() {
    const m = exportMarkup();
    Z.download((ctx.doc.title || 'mindmap') + '.svg', m.svg, 'image/svg+xml');
    Z.toast('已导出 SVG', 'ok');
  }

  function exportPng() {
    const m = exportMarkup();
    const svgBlob = new Blob([m.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const c = document.createElement('canvas');
      c.width = m.w * scale; c.height = m.h * scale;
      const g = c.getContext('2d');
      g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        Z.download((ctx.doc.title || 'mindmap') + '.png', blob);
        Z.toast('已导出 PNG', 'ok');
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = () => { Z.toast('PNG 导出失败，可改用 SVG', 'error'); URL.revokeObjectURL(url); };
    img.src = url;
  }

  Z.Mindmap = {
    mount, buildFromBlocks, fromAITree,
    ensureTree
  };
})(window.ZY);
