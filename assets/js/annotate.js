/* 知忆 · 手绘批注 */
(function (Z) {
  const COLORS = ['#1f2933', '#176b5b', '#c2410c', '#2563eb', '#b91c1c', '#7c3aed'];
  let ctx = null;

  function mount(container, doc, opts = {}) {
    ctx = {
      container, doc,
      save: opts.onChange || (() => {}),
      page: 1,
      pages: Math.max(1, doc.meta?.pages || 1),
      pdf: null,
      bg: null,
      canvas: null,
      strokes: [],
      tool: 'pen',
      color: '#1f2933',
      width: 3,
      drawing: null,
      dirty: false
    };
    if (!doc.annotations) doc.annotations = {};
    container.innerHTML = `<div class="annotate-wrap">
      <div class="an-toolbar">
        <div class="an-group">
          <button class="an-tool on" data-an="tool" data-tool="pen" title="钢笔">${Z.icon('pen')}</button>
          <button class="an-tool" data-an="tool" data-tool="highlighter" title="荧光笔">${Z.icon('highlighter')}</button>
          <button class="an-tool" data-an="tool" data-tool="eraser" title="橡皮">${Z.icon('eraser')}</button>
        </div>
        <div class="an-group an-colors">
          ${COLORS.map((c, i) => `<button class="an-color ${i === 0 ? 'on' : ''}" data-an="color" data-color="${c}" style="--c:${c}"></button>`).join('')}
        </div>
        <label class="an-width">粗细 <input type="range" min="1" max="8" value="3" data-an="width"></label>
        <div class="an-group">
          <button class="btn ghost small" data-an="undo"><span data-ico="undo"></span>撤销</button>
          <button class="btn ghost small" data-an="clear"><span data-ico="trash"></span>清空</button>
          <button class="btn ghost small" data-an="save"><span data-ico="download"></span>导出 PNG</button>
        </div>
        ${ctx.pages > 1 ? `<div class="an-group an-pages">
          <button class="btn ghost small" data-an="prev">${Z.icon('back')}</button>
          <span id="an-page-label">第 1 / ${ctx.pages} 页</span>
          <button class="btn ghost small" data-an="next">${Z.icon('forward')}</button>
        </div>` : ''}
      </div>
      <div class="an-stage">
        <div class="an-paper" id="an-paper">
          <canvas id="an-canvas"></canvas>
          <div class="an-loading" id="an-loading"><span class="spinner"></span><span>加载页面…</span></div>
        </div>
        <div class="an-side">
          <div class="an-tip">
            <strong>画布</strong>
            <p>钢笔圈画连线，荧光笔标重点，橡皮擦拭。笔画自动保存。</p>
          </div>
          <div class="an-tip soft">
            <strong>回忆</strong>
            <p>画完合上原图，凭记忆复述，再对照补漏。</p>
          </div>
        </div>
      </div>
    </div>`;
    Z.hydrateIcons(container);
    ctx.canvas = Z.$('#an-canvas', container);
    bind();
    loadPage();
    return { destroy() { flush(); } };
  }

  function bind() {
    const root = ctx.container;
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-an]')?.dataset.an;
      if (!act) return;
      const el = e.target.closest('[data-an]');
      if (act === 'tool') {
        ctx.tool = el.dataset.tool;
        Z.$$('.an-tool', root).forEach((b) => b.classList.toggle('on', b === el));
        ctx.canvas.style.cursor = ctx.tool === 'eraser' ? 'cell' : 'crosshair';
        return;
      }
      if (act === 'color') {
        ctx.color = el.dataset.color;
        Z.$$('.an-color', root).forEach((b) => b.classList.toggle('on', b === el));
        return;
      }
      if (act === 'undo') { undo(); return; }
      if (act === 'clear') { clearPage(); return; }
      if (act === 'save') { exportPng(); return; }
      if (act === 'prev') { setPage(ctx.page - 1); return; }
      if (act === 'next') { setPage(ctx.page + 1); return; }
    });
    root.addEventListener('input', (e) => {
      if (e.target.matches('[data-an="width"]')) ctx.width = Number(e.target.value);
    });
    const c = ctx.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!ctx.bg) return;
      c.setPointerCapture(e.pointerId);
      const p = pointOf(e);
      if (ctx.tool === 'eraser') {
        ctx.drawing = { erase: true };
        eraseAt(p);
        return;
      }
      const stroke = { tool: ctx.tool, color: ctx.color, width: ctx.width, points: [p] };
      ctx.strokes.push(stroke);
      ctx.drawing = stroke;
      drawStroke(stroke);
    });
    c.addEventListener('pointermove', (e) => {
      if (!ctx.drawing) return;
      const p = pointOf(e);
      if (ctx.drawing.erase) { eraseAt(p); return; }
      const stroke = ctx.drawing;
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.0015) return;
      stroke.points.push(p);
      drawSegment(stroke, last, p);
    });
    const end = () => {
      if (!ctx.drawing) return;
      ctx.drawing = null;
      ctx.dirty = true;
      persist();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointerleave', end);
  }

  function pointOf(e) {
    const rect = ctx.canvas.getBoundingClientRect();
    return [
      Z.clamp((e.clientX - rect.left) / rect.width, 0, 1),
      Z.clamp((e.clientY - rect.top) / rect.height, 0, 1)
    ];
  }

  function strokeStyle(g, s) {
    g.strokeStyle = s.color;
    g.lineWidth = s.tool === 'highlighter' ? Math.max(10, s.width * 5) : s.width * 2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalAlpha = s.tool === 'highlighter' ? 0.32 : 1;
    g.globalCompositeOperation = s.tool === 'highlighter' ? 'multiply' : 'source-over';
  }

  function drawSegment(s, a, b) {
    const g = ctx.canvas.getContext('2d');
    strokeStyle(g, s);
    g.beginPath();
    g.moveTo(a[0] * ctx.canvas.width, a[1] * ctx.canvas.height);
    g.lineTo(b[0] * ctx.canvas.width, b[1] * ctx.canvas.height);
    g.stroke();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function drawStroke(s) {
    const g = ctx.canvas.getContext('2d');
    if (s.points.length === 1) {
      strokeStyle(g, s);
      g.beginPath();
      g.arc(s.points[0][0] * ctx.canvas.width, s.points[0][1] * ctx.canvas.height, (s.tool === 'highlighter' ? s.width * 2.5 : s.width) * 1.2, 0, Math.PI * 2);
      g.fillStyle = s.color;
      g.fill();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      return;
    }
    for (let i = 1; i < s.points.length; i++) drawSegment(s, s.points[i - 1], s.points[i]);
  }

  function redraw() {
    if (!ctx.bg) return;
    const c = ctx.canvas;
    c.width = ctx.bg.width; c.height = ctx.bg.height;
    const g = c.getContext('2d');
    g.drawImage(ctx.bg, 0, 0);
    ctx.strokes.forEach(drawStroke);
  }

  function eraseAt(p) {
    const radius = 0.02 + ctx.width / 400;
    const before = ctx.strokes.length;
    ctx.strokes = ctx.strokes.filter((s) => !s.points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < radius));
    if (ctx.strokes.length !== before) {
      redraw();
      ctx.dirty = true;
      persist();
    }
  }

  function undo() {
    if (!ctx.strokes.length) return;
    ctx.strokes.pop();
    redraw();
    persist();
  }

  async function clearPage() {
    if (!ctx.strokes.length) return;
    if (!(await Z.confirm('清空当前页的所有手绘批注？', { danger: true, ok: '清空' }))) return;
    ctx.strokes = [];
    redraw();
    persist();
  }

  function persist() {
    ctx.doc.annotations[ctx.page] = ctx.strokes.map((s) => ({ ...s, points: s.points.map((p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]) }));
    ctx.save(ctx.doc);
  }
  function flush() { if (ctx && ctx.dirty) persist(); }

  function setPage(n) {
    n = Z.clamp(n, 1, ctx.pages);
    if (n === ctx.page) return;
    persist();
    ctx.page = n;
    const label = Z.$('#an-page-label', ctx.container);
    if (label) label.textContent = `第 ${n} / ${ctx.pages} 页`;
    loadPage();
  }

  async function loadPage() {
    const loading = Z.$('#an-loading', ctx.container);
    if (loading) loading.hidden = false;
    ctx.strokes = (ctx.doc.annotations[ctx.page] || []).map((s) => ({ ...s, points: s.points || [] }));
    try {
      if (ctx.doc.sourceBlobId && (ctx.doc.source === 'pdf')) {
        await loadPdfPage();
      } else if (ctx.doc.sourceBlobId && (ctx.doc.source === 'image')) {
        await loadImagePage();
      } else {
        buildWhiteboard();
      }
    } catch (e) {
      console.error(e);
      buildWhiteboard();
    }
    if (loading) loading.hidden = true;
    redraw();
    ctx.canvas.style.cursor = ctx.tool === 'eraser' ? 'cell' : 'crosshair';
  }

  async function loadPdfPage() {
    if (!ctx.pdf) {
      const blob = await Z.DB.getBlob(ctx.doc.sourceBlobId);
      if (!blob) throw new Error('找不到 PDF 原文件');
      const buf = await blob.arrayBuffer();
      ctx.pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      ctx.pages = ctx.pdf.numPages;
      ctx.doc.meta.pages = ctx.pages;
    }
    const page = await ctx.pdf.getPage(Z.clamp(ctx.page, 1, ctx.pages));
    const vp = page.getViewport({ scale: 1.6 });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    ctx.bg = c;
  }

  async function loadImagePage() {
    const blob = await Z.DB.getBlob(ctx.doc.sourceBlobId);
    if (!blob) throw new Error('找不到图片');
    const img = await Z.Import.loadImage(blob);
    const maxW = 1400;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    ctx.bg = c;
  }

  function buildWhiteboard() {
    const c = document.createElement('canvas');
    c.width = 1000; c.height = 1414;
    const g = c.getContext('2d');
    g.fillStyle = '#fdfbf7';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(23,107,91,.08)';
    g.fillRect(0, 0, c.width, 12);

    const text = ctx.doc.blocks.map((b) => b.text).join('\n');
    const perPage = 620;
    const totalPages = Math.max(1, Math.ceil(text.length / perPage));
    ctx.pages = totalPages;
    const chunk = text.slice((ctx.page - 1) * perPage, ctx.page * perPage);

    g.fillStyle = '#29423c';
    g.font = '600 30px "Songti SC", "Noto Serif SC", serif';
    wrapDraw(g, ctx.doc.title || '批注板', 80, 92, 840, 42, 2);

    g.fillStyle = '#5d6b66';
    g.font = '20px "Songti SC", "Noto Serif SC", serif';
    let y = 180;
    const lines = chunk.split(/\n+/).filter(Boolean);
    for (const line of lines) {
      y = wrapDraw(g, line, 80, y, 840, 38, 30, '#3b4b46');
      if (y > c.height - 100) break;
    }

    // 页脚
    g.strokeStyle = 'rgba(0,0,0,.08)';
    g.beginPath(); g.moveTo(80, c.height - 70); g.lineTo(920, c.height - 70); g.stroke();
    g.fillStyle = '#9aa39f';
    g.font = '16px system-ui, sans-serif';
    g.fillText(`知忆批注板 · 第 ${ctx.page} / ${totalPages} 页`, 80, c.height - 40);
    ctx.bg = c;
    const label = Z.$('#an-page-label', ctx.container);
    if (label) label.textContent = `第 ${ctx.page} / ${totalPages} 页`;
  }

  function wrapDraw(g, text, x, y, maxW, lineH, maxLines = 99, color) {
    if (color) g.fillStyle = color;
    const tokens = /[\u4e00-\u9fff]/.test(text) ? Array.from(text) : text.split(/(\s+)/);
    let line = '', count = 0;
    for (const tk of tokens) {
      if (g.measureText(line + tk).width > maxW && line) {
        g.fillText(line.trim(), x, y);
        line = tk.trim() ? tk : '';
        y += lineH;
        count++;
        if (count >= maxLines) return y;
      } else line += tk;
    }
    if (line) { g.fillText(line.trim(), x, y); y += lineH; }
    return y + 8;
  }

  function exportPng() {
    persist();
    ctx.canvas.toBlob((blob) => {
      Z.download((ctx.doc.title || '批注') + `-p${ctx.page}.png`, blob);
      Z.toast('已导出图片', 'ok');
    }, 'image/png');
  }

  Z.Annotate = { mount };
})(window.ZY);
