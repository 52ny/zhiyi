/* 知忆 · 资料导入与内容提取 */
(function (Z) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = Z.url('assets/vendor/pdfjs/pdf.worker.min.js');

  const HEADING_RE = /^(第[一二三四五六七八九十百\d]+[章节讲部分篇]|Chapter\s+[\dIVX]+|Part\s+[\dIVX]+|[一二三四五六七八九十]+、|\d+(?:\.\d+){0,3}[、.\s]|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|定义[：:\s]|定理[：:\s]|公式[：:\s]|性质[：:\s]|原理[：:\s]|知识点[：:\s]|考点[：:\s]|例题[：:\s]|总结[：:\s])/i;
  const BULLET_RE = /^([•·▪◦●○◆◇■□▸▹►▶]|[-*+]\s|\(?\d+[.)、]\s?|[①-⑳])\s*/;
  const END_PUNCT = /[。！？!?；;：:.]$/;

  let ocrWorker = null;
  let ocrLoading = null;

  function makeDoc(patch) {
    const now = Date.now();
    return Object.assign({
      id: Z.uid('doc'),
      title: '未命名资料',
      type: 'text',
      source: 'txt',
      lang: null,
      blocks: [],
      translations: {},
      highlights: [],
      cards: [],
      annotations: {},
      notes: [],
      mindmap: null,
      meta: {},
      createdAt: now,
      updatedAt: now
    }, patch);
  }

  function cleanInline(s) {
    return String(s || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([，。；：！？、])/g, '$1')
      .trim();
  }

  function stripMd(s) {
    return s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/~~(.*?)~~/g, '$1');
  }

  function headingLevel(line) {
    const s = line.trim();
    if (!s || s.length > 90) return 0;
    // 选项、答案、解析不是标题
    if (/^[A-DＡ-Ｄ][.、．)）]|^答案|^解析|^解[:：]|^第\s*\d+\s*页/.test(s)) return 0;
    if (/^第[一二三四五六七八九十百\d]+[章篇]|^Chapter\s|^Part\s/i.test(s)) return 1;
    if (/^[一二三四五六七八九十]+、|^\d+(?:\.\d+)?[、.\s]/.test(s)) return 2;
    if (HEADING_RE.test(s)) return 3;
    // 短句无标点，且像小标题
    if (s.length <= 28 && !/[。！？!?；;，,]$/.test(s) && !/[，,]/.test(s) && !BULLET_RE.test(s)) return 3;
    return 0;
  }

  function blocksFromLines(lines, page) {
    const out = [];
    let buf = [];
    function flush() {
      if (!buf.length) return;
      const text = cleanInline(buf.join(' '));
      buf = [];
      if (text.length < 2) return;
      out.push({ t: 'p', text, page });
    }
    for (const raw of lines) {
      const line = cleanInline(raw);
      if (!line) continue;
      if (/^\d{1,3}$/.test(line)) continue; // 页码
      const lvl = headingLevel(line);
      if (lvl) {
        flush();
        out.push({ t: 'h' + Math.min(lvl, 3), text: line.replace(/\s+$/, ''), page });
        continue;
      }
      if (BULLET_RE.test(line)) {
        flush();
        out.push({ t: 'li', text: line.replace(BULLET_RE, '').trim(), page });
        continue;
      }
      buf.push(line);
      if (END_PUNCT.test(line) && buf.join(' ').length > 16) flush();
    }
    flush();
    return out;
  }

  /* ---------- 按用户描述清理提取结果 ---------- */
  const NOISE_RE = /^(第\s*\d+\s*页(\s*[/／共]\s*\d+\s*页)?|page\s*\d+(\s*(of|\/)\s*\d+)?|-{0,3}\s*\d{1,4}\s*-{0,3})$/i;
  const JUNK_RE = /扫码|关注公众号|微信公众号|微信号|QQ群|点击关注|版权声明|侵权|广告|http(s)?:\/\/|www\./i;

  function intentOf(wanted) {
    const w = String(wanted || '');
    if (!w.trim()) return '';
    if (/题目|试题|试卷|选择题|填空题|选项|答案|解析|真题|练习/.test(w)) return 'quiz';
    if (/公式|定理|定义|概念|知识点|要点|结论|原理|条件/.test(w)) return 'concept';
    if (/单词|词汇|生词|英文|英语|外文/.test(w)) return 'words';
    if (/翻译|译文|对照/.test(w)) return 'translate';
    return 'plain';
  }

  function filterByWanted(blocks, wanted) {
    const intent = intentOf(wanted);
    if (!intent || intent === 'plain' || intent === 'translate') return blocks;
    const keep = (b) => {
      const t = b.text || '';
      if (b.t && b.t[0] === 'h') return true;
      if (intent === 'quiz') {
        return /[A-DＡ-Ｄ][.、．)）]|^\s*[（(]?\d+[.、)）]|答案|解析|解[:：]|题干|选项|判断|填空|计算|证明|选择/.test(t) || t.length <= 80;
      }
      if (intent === 'concept') {
        return /定义|定理|公式|性质|条件|结论|证明|推导|原理|概念|规律|=|≤|≥|√|∑|∫|Δ|⇌/.test(t);
      }
      if (intent === 'words') return /[A-Za-z]{3,}/.test(t);
      return true;
    };
    const picked = blocks.filter(keep);
    return picked.length >= Math.max(3, Math.ceil(blocks.length * 0.22)) ? picked : blocks;
  }

  /** 去页眉页脚、页码、跨页重复行，并按用户描述筛选 */
  function cleanBlocks(blocks, wanted) {
    let out = (blocks || []).filter((b) => b && b.text && b.text.trim());
    out = out.filter((b) => {
      const t = b.text.trim();
      return !NOISE_RE.test(t) && !(JUNK_RE.test(t) && t.length < 60);
    });
    const counts = new Map();
    out.forEach((b) => {
      const k = b.text.trim();
      if (k.length <= 40) counts.set(k, (counts.get(k) || 0) + 1);
    });
    out = out.filter((b) => !(b.text.trim().length <= 40 && (counts.get(b.text.trim()) || 0) >= 3));
    return filterByWanted(out, wanted);
  }

  function blocksFromPlainText(text) {
    const norm = String(text || '').replace(/\r/g, '').replace(/\t/g, ' ').trim();
    if (!norm) return [];
    const out = [];
    const STANDALONE = /^([A-DＡ-Ｄ][.、．)）]|答案|解析|解[:：]|第?\s*\d+\s*[.、)）]|例题|注意|【|扫码|关注|版权|侵权|\(?\d+\)?\s)/;
    norm.split(/\n{2,}/).forEach((para) => {
      const lines = para.split('\n').map((x) => x.trim()).filter(Boolean);
      let buf = [];
      const flush = () => {
        if (!buf.length) return;
        const t = cleanInline(buf.join(' '));
        buf = [];
        if (t.length > 1) out.push({ t: 'p', text: t });
      };
      lines.forEach((line) => {
        if (/^#{1,6}\s+/.test(line)) { flush(); out.push({ t: 'h2', text: line.replace(/^#+\s+/, '') }); return; }
        if (BULLET_RE.test(line) && line.length <= 90) { flush(); out.push({ t: 'li', text: line.replace(BULLET_RE, '').trim() }); return; }
        const lvl = headingLevel(line);
        if (lvl && line.length <= 40) { flush(); out.push({ t: 'h' + Math.min(lvl, 3), text: line }); return; }
        buf.push(line);
        // 题目、选项、答案、广告、页码等短行独立成块，便于后续按描述过滤
        if (STANDALONE.test(line) || line.length <= 48) flush();
        else if (END_PUNCT.test(line) && buf.join(' ').length > 40) flush();
      });
      flush();
    });
    return out;
  }

  /** 用校对后的文本重建资料 */
  function fromEdited(text, doc, title) {
    const next = Object.assign({}, doc, {
      title: title || doc.title,
      blocks: blocksFromPlainText(text),
      updatedAt: Date.now()
    });
    return finishDoc(next);
  }

  /** 用 AI 按用户描述重组（需本地模型或云端接口） */
  async function aiRefine(doc, wanted) {
    if (!Z.AI || !Z.AI.isChat || !Z.AI.isChat()) throw new Error('需要本地模型或云端接口');
    const text = (doc.blocks || []).map((b) => b.text).join('\n').slice(0, 9000);
    const raw = await Z.AI.chat([
      { role: 'system', content: '你是文本整理助手，只输出严格 JSON，不编造原文没有的内容。' },
      { role: 'user', content: `从下面提取结果中，按用户要求保留与整理内容。\n用户要求：${wanted || '整理成通顺的正文'}\n输出：{"blocks":[{"t":"h2|h3|p|li","text":"..."}]}\n提取结果：\n${text}` }
    ], { json: true, maxTokens: 2200 });
    const data = Z.AI.parseJSON(raw);
    const blocks = (data.blocks || [])
      .filter((b) => b && b.text)
      .map((b) => ({ t: ['h1', 'h2', 'h3', 'p', 'li', 'quote'].includes(b.t) ? b.t : 'p', text: String(b.text).trim() }));
    if (!blocks.length) throw new Error('没有整理出可用内容');
    doc.blocks = blocks;
    return finishDoc(doc);
  }

  function detectType(blocks, lang) {
    const text = blocks.map((b) => b.text).join('\n');
    const heads = blocks.filter((b) => b.t[0] === 'h').length;
    const lis = blocks.filter((b) => b.t === 'li').length;
    const kw = (text.match(/定义|定理|公式|性质|分类|特点|原理|步骤|注意|例题|考点|知识点|概念|条件|结论|证明|推导|模型|算法|复杂度|结构|机制/gi) || []).length;
    let score = 0;
    if (heads >= 2) score += 2;
    if (heads >= 5) score += 1;
    if (lis >= 6) score += 2;
    if (kw >= 6) score += 2;
    if (kw >= 14) score += 1;
    if (blocks.length >= 6 && blocks.filter((b) => b.t === 'p' && b.text.length > 90).length >= 4) score -= 1;
    if (lang !== 'zh') {
      // 外语长文优先按“课文”处理
      if (text.length > 700 && heads < 4) return 'text';
    }
    return score >= 3 ? 'knowledge' : 'text';
  }

  function finishDoc(doc, opts = {}) {
    doc.blocks = doc.blocks.filter((b) => b && b.text && b.text.trim());
    const text = doc.blocks.map((b) => b.text).join('\n');
    doc.lang = doc.lang || Z.langOf(text) || 'zh';
    doc.type = opts.forceType || detectType(doc.blocks, doc.lang);
    doc.meta = Object.assign(doc.meta || {}, {
      words: (text.match(/[A-Za-z]+|[\u4e00-\u9fff]/g) || []).length,
      minutes: Math.max(1, Math.round((text.match(/[A-Za-z]+|[\u4e00-\u9fff]/g) || []).length / 320)),
      pages: doc.meta?.pages || 1
    });
    if (!doc.title || doc.title === '未命名资料') {
      const firstH = doc.blocks.find((b) => b.t[0] === 'h');
      doc.title = firstH ? firstH.text.slice(0, 40) : Z.truncate(doc.blocks[0]?.text || '未命名资料', 26);
    }
    return doc;
  }

  /* ---------- OCR ---------- */
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrLoading) return ocrLoading;
    ocrLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = Z.url('assets/vendor/tesseract/tesseract.min.js');
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('OCR 引擎加载失败'));
      document.head.appendChild(s);
    });
    return ocrLoading;
  }

  async function getOcrWorker(onProgress) {
    if (ocrWorker) return ocrWorker;
    const T = await loadTesseract();
    const options = {
      workerPath: Z.url('assets/vendor/tesseract/worker.min.js'),
      corePath: Z.url('assets/vendor/tesseract/core'),
      langPath: Z.url('assets/vendor/tesseract/lang'),
      workerBlobURL: false,
      logger: (m) => {
        if (onProgress && m.progress != null) onProgress(m);
      }
    };
    ocrWorker = await T.createWorker('chi_sim+eng', 1, options);
    try { await ocrWorker.setParameters({ preserve_interword_spaces: '1' }); } catch (e) {}
    return ocrWorker;
  }

  /** 灰度 + 对比度拉伸 + 放大：显著提升截图/拍照的识别率 */
  function enhanceForOcr(source) {
    const w0 = source.naturalWidth || source.width;
    const h0 = source.naturalHeight || source.height;
    if (!w0 || !h0) return source;
    const scale = Math.min(3, Math.max(1, 1400 / w0, w0 < 900 ? 1400 / w0 : 1));
    const c = document.createElement('canvas');
    c.width = Math.min(3000, Math.round(w0 * scale));
    c.height = Math.round(h0 * (c.width / w0));
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(source, 0, 0, c.width, c.height);
    try {
      const img = g.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      let min = 255, max = 0;
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = Math.max(1, max - min);
      const stretch = range < 190;
      for (let i = 0; i < d.length; i += 4) {
        let v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (stretch) v = ((v - min) / range) * 255;
        else v = 128 + (v - 128) * 1.15;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(img, 0, 0);
    } catch (e) {}
    return c;
  }

  async function ocrImage(source, onProgress) {
    const worker = await getOcrWorker(onProgress);
    const res = await worker.recognize(source, {}, { text: true, blocks: false });
    return {
      text: (res.data?.text || '').replace(/\r/g, ''),
      confidence: Math.round(res.data?.confidence || 0)
    };
  }

  /* ---------- 图片 ---------- */
  async function coverFromImage(img, w = 520) {
    const ratio = img.height / img.width;
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round(w * ratio);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  }

  async function loadImage(blobOrUrl) {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('图片读取失败'));
        i.src = url;
      });
      return img;
    } finally {
      if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function fromImage(file, ctx) {
    ctx.progress(8, '读取图片…');
    const img = await loadImage(file);
    const cover = await coverFromImage(img);
    ctx.progress(16, '正在识别文字（首次需加载 OCR 引擎）…');
    let text = '';
    let conf = 0;
    try {
      const enhanced = enhanceForOcr(img);
      const r = await ocrImage(enhanced, (m) => {
        if (m.status === 'recognizing text') ctx.progress(20 + Math.round(m.progress * 70), '识别文字 ' + Math.round(m.progress * 100) + '%');
      });
      text = r.text;
      conf = r.confidence;
    } catch (e) {
      text = '';
    }
    const doc = makeDoc({ title: file.name.replace(/\.[^.]+$/, ''), source: 'image', lang: 'zh', cover });
    doc.meta.ocr = true;
    doc.meta.ocrConfidence = conf;
    // 图片本身可作为批注底图
    const blobId = Z.uid('blob');
    await Z.DB.putBlob(blobId, file);
    doc.sourceBlobId = blobId;
    doc.meta.imageWidth = img.naturalWidth;
    doc.meta.imageHeight = img.naturalHeight;
    const paras = text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    if (paras.length) {
      doc.blocks = paras.map((p) => ({ t: 'p', text: cleanInline(p.replace(/\n/g, ' ')), page: 1 }));
    } else {
      doc.blocks = [{ t: 'p', text: '未识别到文字。你仍可以在「手绘」标签中打开这张图片做批注，或手动录入内容。', page: 1 }];
    }
    doc.lang = Z.langOf(text || '');
    return finishDoc(doc, { forceType: ctx.forceType });
  }

  /* ---------- PDF ---------- */
  function itemsToLines(items) {
    const lines = [];
    let cur = null;
    for (const item of items) {
      const str = item.str;
      if (!str) continue;
      const y = item.transform[5];
      if (!cur || Math.abs(y - cur.y) > 3) {
        cur = { y, text: '', lastX: null, lastW: 0 };
        lines.push(cur);
      }
      if (cur.text) {
        const gap = item.transform[4] - (cur.lastX + cur.lastW);
        const prev = cur.text.slice(-1);
        const next = str.slice(0, 1);
        const cjk = /[\u4e00-\u9fff，。！？；：]/.test(prev) && /[\u4e00-\u9fff，。！？；：]/.test(next);
        if (gap > 1.5 && !cjk && !/\s$/.test(cur.text) && !/^\s/.test(str)) cur.text += ' ';
      }
      cur.text += str;
      cur.lastX = item.transform[4];
      cur.lastW = item.width || 0;
    }
    return lines.map((l) => cleanInline(l.text)).filter(Boolean);
  }

  async function renderPdfPage(pdf, n, scale = 2) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas;
  }

  async function fromPdf(file, ctx) {
    ctx.progress(5, '解析 PDF…');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: buf,
      cMapUrl: Z.url('assets/vendor/pdfjs/cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: Z.url('assets/vendor/pdfjs/standard_fonts/')
    }).promise;
    const total = pdf.numPages;
    const doc = makeDoc({ title: file.name.replace(/\.pdf$/i, ''), source: 'pdf', meta: { pages: total } });
    const blobId = Z.uid('blob');
    await Z.DB.putBlob(blobId, new Blob([buf], { type: 'application/pdf' }));
    doc.sourceBlobId = blobId;

    // 封面
    try {
      const c = await renderPdfPage(pdf, 1, 0.55);
      doc.cover = c.toDataURL('image/jpeg', 0.7);
    } catch (e) {}

    let allBlocks = [];
    let chars = 0;
    for (let n = 1; n <= total; n++) {
      ctx.progress(8 + Math.round((n / total) * 62), `提取文字 ${n}/${total} 页`);
      try {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const lines = itemsToLines(content.items);
        chars += lines.join('').length;
        allBlocks = allBlocks.concat(blocksFromLines(lines, n));
      } catch (e) {}
      if (ctx.cancelled) break;
    }

    // 扫描版：文字极少 → OCR
    if (!ctx.cancelled && chars < total * 25) {
      ctx.progress(72, '检测到扫描版 PDF，正在 OCR（较慢）…');
      const limit = Math.min(total, 30);
      doc.blocks = [];
      for (let n = 1; n <= limit; n++) {
        ctx.progress(72 + Math.round((n / limit) * 26), `OCR ${n}/${limit} 页`);
        try {
          const canvas = await renderPdfPage(pdf, n, 2);
          const r = await ocrImage(enhanceForOcr(canvas), (m) => {
            if (m.status === 'recognizing text') ctx.progress(72 + Math.round(((n - 1 + m.progress) / limit) * 26), `OCR ${n}/${limit} 页 · ${Math.round(m.progress * 100)}%`);
          });
          const lines = r.text.split(/\n+/).map((s) => cleanInline(s)).filter(Boolean);
          doc.blocks = doc.blocks.concat(blocksFromLines(lines, n));
        } catch (e) {
          doc.blocks.push({ t: 'p', text: `第 ${n} 页 OCR 失败，请在手绘标签中查看原页。`, page: n });
        }
        if (ctx.cancelled) break;
      }
      doc.meta.ocr = true;
      if (total > limit) doc.meta.ocrPartial = limit;
    } else {
      doc.blocks = allBlocks;
    }

    if (!doc.blocks.length) {
      doc.blocks = [{ t: 'p', text: '未能从 PDF 中提取文字，可在「手绘」中对原页做批注。', page: 1 }];
    }
    return finishDoc(doc, { forceType: ctx.forceType });
  }

  /* ---------- DOCX ---------- */
  function blocksFromDom(root) {
    const blocks = [];
    const nodes = root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td');
    nodes.forEach((el) => {
      const text = cleanInline(el.textContent);
      if (!text) return;
      if (el.closest('table') && el.tagName !== 'TD') return;
      if (el.tagName === 'TD') { blocks.push({ t: 'li', text }); return; }
      if (/^H[1-6]$/.test(el.tagName)) blocks.push({ t: 'h' + Math.min(3, Number(el.tagName[1])), text });
      else if (el.tagName === 'LI') blocks.push({ t: 'li', text });
      else if (el.tagName === 'BLOCKQUOTE') blocks.push({ t: 'quote', text });
      else if (el.tagName === 'PRE') blocks.push({ t: 'code', text: el.textContent.trim() });
      else blocks.push({ t: 'p', text });
    });
    return blocks;
  }

  async function fromDocx(file) {
    const buf = await file.arrayBuffer();
    const res = await mammoth.convertToHtml({ arrayBuffer: buf });
    const dom = new DOMParser().parseFromString('<div id="r">' + res.value + '</div>', 'text/html');
    let blocks = blocksFromDom(dom.getElementById('r'));
    if (!blocks.length) {
      const raw = await mammoth.extractRawText({ arrayBuffer: buf });
      blocks = raw.value.split(/\n{2,}/).map((p) => ({ t: 'p', text: cleanInline(p.replace(/\n/g, ' ')) })).filter((b) => b.text);
    }
    const doc = makeDoc({ title: file.name.replace(/\.docx?$/i, ''), source: 'docx', blocks, meta: { pages: 1 } });
    return finishDoc(doc);
  }

  /* ---------- PPTX ---------- */
  async function fromPptx(file, ctx) {
    ctx.progress(20, '解析幻灯片…');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));
    const blocks = [];
    for (let i = 0; i < names.length; i++) {
      const xml = await zip.file(names[i]).async('text');
      const dom = new DOMParser().parseFromString(xml, 'text/xml');
      const paras = Array.from(dom.querySelectorAll('a\\:p, p')).map((p) => cleanInline(Array.from(p.querySelectorAll('a\\:t, t')).map((t) => t.textContent).join(' '))).filter(Boolean);
      if (!paras.length) continue;
      blocks.push({ t: 'h2', text: `第 ${i + 1} 页 · ${Z.truncate(paras[0], 32)}`, page: i + 1 });
      paras.slice(1).forEach((p) => blocks.push({ t: 'p', text: p, page: i + 1 }));
      ctx.progress(20 + Math.round(((i + 1) / names.length) * 70), `解析幻灯片 ${i + 1}/${names.length}`);
    }
    const doc = makeDoc({ title: file.name.replace(/\.pptx$/i, ''), source: 'pptx', blocks, meta: { pages: names.length || 1 } });
    return finishDoc(doc);
  }

  /* ---------- Markdown ---------- */
  function fromMarkdown(text, title) {
    const lines = text.replace(/\r/g, '').split('\n');
    const blocks = [];
    let buf = [];
    let inCode = false;
    let code = [];
    const flush = () => {
      if (!buf.length) return;
      const t = cleanInline(buf.join(' '));
      buf = [];
      if (t) blocks.push({ t: 'p', text: t });
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (/^```/.test(line)) {
        if (inCode) { blocks.push({ t: 'code', text: code.join('\n') }); code = []; inCode = false; }
        else { flush(); inCode = true; }
        continue;
      }
      if (inCode) { code.push(raw); continue; }
      if (!line) { flush(); continue; }
      const hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { flush(); blocks.push({ t: 'h' + Math.min(3, hm[1].length), text: stripMd(hm[2]) }); continue; }
      if (/^>\s?/.test(line)) { flush(); blocks.push({ t: 'quote', text: stripMd(line.replace(/^>\s?/, '')) }); continue; }
      if (/^([-*+]|\d+[.)])\s+/.test(line)) { flush(); blocks.push({ t: 'li', text: stripMd(line.replace(/^([-*+]|\d+[.)])\s+/, '')) }); continue; }
      if (/^\|.*\|$/.test(line)) { flush(); blocks.push({ t: 'li', text: stripMd(line.replace(/^\||\|$/g, '').replace(/\|/g, ' · ')) }); continue; }
      if (/^---+$/.test(line)) { flush(); continue; }
      buf.push(stripMd(line));
    }
    flush();
    if (inCode && code.length) blocks.push({ t: 'code', text: code.join('\n') });
    const doc = makeDoc({ title: title || '粘贴的内容', source: 'md', blocks, meta: { pages: 1 } });
    if (!title) {
      const h = blocks.find((b) => b.t[0] === 'h');
      doc.title = h ? h.text : Z.truncate(blocks[0]?.text || '未命名资料', 28);
    }
    return finishDoc(doc);
  }

  /* ---------- 纯文本 ---------- */
  function fromPlain(text, title, opts = {}) {
    const blocks = cleanBlocks(blocksFromPlainText(text), opts.wanted);
    const doc = makeDoc({ title: title || '粘贴的内容', source: 'txt', blocks, meta: { pages: 1, wanted: opts.wanted || '' } });
    if (!title) {
      const h = blocks.find((b) => b.t[0] === 'h');
      doc.title = h ? h.text : Z.truncate(blocks[0]?.text || '未命名资料', 28);
    }
    return finishDoc(doc);
  }

  /* ---------- HTML ---------- */
  function fromHtml(text, title) {
    const dom = new DOMParser().parseFromString(text, 'text/html');
    dom.querySelectorAll('script,style,nav,footer,header,svg,noscript').forEach((n) => n.remove());
    let blocks = blocksFromDom(dom.body);
    if (!blocks.length) {
      const raw = (dom.body.innerText || dom.body.textContent || '').trim();
      return fromPlain(raw, title);
    }
    const doc = makeDoc({ title: title || (dom.title || '未命名资料'), source: 'html', blocks, meta: { pages: 1 } });
    return finishDoc(doc);
  }

  /* ---------- 入口 ---------- */
  async function fromFile(file, ctx) {
    const name = file.name || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    ctx.progress(3, `读取 ${name}`);
    if (ext === 'pdf' || file.type === 'application/pdf') return fromPdf(file, ctx);
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext) || /^image\//.test(file.type)) return fromImage(file, ctx);
    if (ext === 'docx' || ext === 'doc') {
      if (ext === 'doc') throw new Error('暂不支持旧版 .doc，请另存为 .docx 后导入');
      return fromDocx(file);
    }
    if (ext === 'pptx') return fromPptx(file, ctx);
    if (ext === 'md' || ext === 'markdown') return fromMarkdown(await file.text(), file.name.replace(/\.(md|markdown)$/i, ''));
    if (ext === 'html' || ext === 'htm') return fromHtml(await file.text(), file.name.replace(/\.(html?|htm)$/i, ''));
    if (ext === 'txt' || file.type.startsWith('text/')) return fromPlain(await file.text(), file.name.replace(/\.[^.]+$/, ''));
    throw new Error('不支持的文件类型：' + (ext || file.type || '未知'));
  }

  async function extractFiles(files, opts = {}) {
    const arr = Array.from(files || []);
    if (!arr.length) return [];
    const docs = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      if (file.size > 80 * 1024 * 1024) { Z.toast(`${file.name} 超过 80MB，已跳过`, 'error'); continue; }
      const b = Z.busy(`解析 ${file.name}`, `(${i + 1}/${arr.length}) 准备中…`);
      try {
        const ctx = {
          progress: (pct, sub) => b.set(pct, sub),
          get cancelled() { return b.cancelled; },
          forceType: opts.forceType
        };
        const doc = await fromFile(file, ctx);
        if (b.cancelled) { b.close(); continue; }
        doc.blocks = cleanBlocks(doc.blocks, opts.wanted);
        doc.meta = Object.assign(doc.meta || {}, { wanted: opts.wanted || '' });
        finishDoc(doc);
        docs.push(doc);
        b.close();
      } catch (e) {
        b.close();
        console.error(e);
        Z.toast(`${file.name} 解析失败：${e.message}`, 'error', 4200);
      }
    }
    return docs;
  }

  async function saveDocs(docs) {
    const saved = [];
    for (const doc of docs || []) {
      await Z.DB.putDoc(doc);
      saved.push(doc);
    }
    return saved;
  }

  async function handleFiles(files, opts = {}) {
    const docs = await extractFiles(files, opts);
    await saveDocs(docs);
    docs.forEach((doc) => Z.toast(`已导入「${doc.title}」`, 'ok'));
    return docs;
  }

  Z.Import = {
    handleFiles, extractFiles, saveDocs, fromFile, fromPlain, fromMarkdown, fromHtml, fromImage, fromPdf,
    makeDoc, finishDoc, detectType, loadImage, ocrImage, getOcrWorker, coverFromImage, enhanceForOcr,
    cleanBlocks, blocksFromPlainText, fromEdited, aiRefine, intentOf
  };
})(window.ZY);
