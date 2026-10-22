/* 知忆 · 基础工具 */
window.ZY = window.ZY || {};

(function (Z) {
  const ICONS = {
    library: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H19"/><path d="M8 7h7M8 10.5h5"/>',
    review: '<path d="M3 11a9 9 0 1 1 2.6 6.3"/><path d="M3 5v6h6"/><path d="M12 8v4.5l3 1.8"/>',
    lab: '<path d="M9 3h6M10 3v6.2L4.9 18a2 2 0 0 0 1.7 3h10.8a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 15h9"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    forward: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="M7 4.5v15l13-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    translate: '<path d="M4 5h10M9 3v2"/><path d="M6 9c1.8 3 4.5 5.4 8 7"/><path d="M13 9c-1 3-3.3 5.6-6.5 7"/><path d="M14 20l4-9 4 9"/><path d="M15.5 17h5"/>',
    highlighter: '<path d="m9 14 7-7 3 3-7 7H8z"/><path d="M9 14l-3 3v3h3l3-3"/><path d="M4 21h6"/>',
    mindmap: '<rect x="9" y="3" width="6" height="4" rx="1.4"/><rect x="3" y="16" width="6" height="4" rx="1.4"/><rect x="15" y="16" width="6" height="4" rx="1.4"/><path d="M12 7v4M6 16v-3h12v3"/>',
    pen: '<path d="m14.5 4.5 5 5L8 21H3v-5z"/><path d="m12.5 6.5 5 5"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2.2"/><path d="M7 3h11a2 2 0 0 1 2 2v11"/><path d="M7 11h5M7 15h5"/>',
    note: '<path d="M5 3h11l4 4v14H5z"/><path d="M16 3v5h5"/><path d="M8 12h8M8 16h6"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    eraser: '<path d="m7 14 7-7 5 5-7 7H7z"/><path d="m10 11 5 5"/><path d="M5 21h14"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h2.2a1.4 1.4 0 1 1 0 2.8H9zM9 13v5"/><path d="M14 13v5h1.5a2.5 2.5 0 0 0 0-5z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    collapse: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-2.6-1.5-4.6-3-6.2-.6 1.6-1.4 2.8-2.6 3.5.2-2.7-.8-5.4-3.4-7.3.2 3.2-1.8 4.7-3.4 6.5A8.7 8.7 0 0 0 5 15.5C5 19.3 8 22 12 22z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/>',
    clock2: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 7.5V12l3 2"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-3.2-3.2"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-3.2-3.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3M14 9l2 2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    heart: '<path d="M12 20.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 5.5-8 11-8 11z"/>',
    star: '<path d="m12 3 2.7 5.7 6.3.9-4.6 4.4 1.1 6.3-5.5-3-5.5 3 1.1-6.3L3 9.6l6.3-.9z"/>',
    pin: '<path d="m12 17 5-5-2-2 1-5-2 2-5 1-2-2-5 5 8 8z"/><path d="M4 20h6"/>',
    paperclip: '<path d="M21 11.5 12 20a5.5 5.5 0 0 1-7.8-7.8l9-9a4 4 0 0 1 5.6 5.6l-8.5 8.5a2.5 2.5 0 0 1-3.5-3.5l7.5-7.5"/>'
  };

  Z.icon = function (name, cls = '') {
    const p = ICONS[name] || ICONS.file;
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };

  Z.hydrateIcons = function (root = document) {
    root.querySelectorAll('[data-ico]').forEach((el) => {
      if (el.dataset.icoReady) return;
      el.insertAdjacentHTML('afterbegin', Z.icon(el.dataset.ico));
      el.dataset.icoReady = '1';
    });
  };

  Z.$ = (sel, root = document) => root.querySelector(sel);
  Z.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  Z.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  Z.uid = function (prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  Z.clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  Z.debounce = function (fn, ms = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  Z.toast = function (msg, type = 'info', ms = 2800) {
    const root = Z.$('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span class="toast-ico">${Z.icon(type === 'error' ? 'info' : type === 'ok' ? 'check-circle' : 'sparkle')}</span><span>${Z.esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
    return el;
  };

  Z.modal = function (opts = {}) {
    const root = Z.$('#modal-root');
    root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'modal-veil';
    wrap.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''} ${opts.cls || ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><div><h3>${Z.esc(opts.title || '')}</h3>${opts.sub ? `<p>${Z.esc(opts.sub)}</p>` : ''}</div><button class="ghost-icon modal-x" data-ico="close" aria-label="关闭"></button></div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.footer === null ? '' : `<div class="modal-foot">${opts.footer || ''}</div>`}
    </div>`;
    root.appendChild(wrap);
    Z.hydrateIcons(wrap);

    const close = () => { wrap.classList.add('out'); setTimeout(() => { if (wrap.parentNode) wrap.remove(); }, 200); };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    Z.$$('.modal-x', wrap).forEach((b) => b.addEventListener('click', close));
    const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    if (opts.onMount) opts.onMount(wrap, close);
    return { root: wrap, body: Z.$('.modal-body', wrap), close };
  };

  Z.confirm = function (message, opts = {}) {
    return new Promise((resolve) => {
      const m = Z.modal({
        title: opts.title || '请确认',
        body: `<p class="confirm-text">${Z.esc(message)}</p>`,
        footer: `<button class="btn ghost" data-act="no">取消</button><button class="btn ${opts.danger ? 'danger' : 'primary'}" data-act="yes">${Z.esc(opts.ok || '确定')}</button>`
      });
      m.root.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (!act) return;
        m.close(); resolve(act.dataset.act === 'yes');
      });
    });
  };

  Z.promptText = function (title, value = '', opts = {}) {
    return new Promise((resolve) => {
      const m = Z.modal({
        title,
        body: `<textarea class="input area" rows="${opts.rows || 3}" id="prompt-input">${Z.esc(value)}</textarea>`,
        footer: `<button class="btn ghost" data-act="no">取消</button><button class="btn primary" data-act="yes">保存</button>`,
        onMount: (root) => setTimeout(() => { const t = Z.$('#prompt-input', root); t.focus(); t.select(); }, 30)
      });
      m.root.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (!act) return;
        const v = Z.$('#prompt-input', m.root).value.trim();
        m.close(); resolve(act.dataset.act === 'yes' ? v : null);
      });
      m.root.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          const v = Z.$('#prompt-input', m.root).value.trim();
          m.close(); resolve(v);
        }
      });
    });
  };

  Z.busy = function (title, sub = '请稍候') {
    const el = Z.$('#busy');
    const t = Z.$('#busy-title'), s = Z.$('#busy-sub'), fill = Z.$('#busy-fill'), cancel = Z.$('#busy-cancel');
    el.hidden = false;
    t.textContent = title; s.textContent = sub; fill.style.width = '0%';
    cancel.hidden = true;
    let cancelled = false;
    cancel.onclick = () => { cancelled = true; s.textContent = '正在取消…'; };
    return {
      set(pct, text) { fill.style.width = Z.clamp(pct, 0, 100) + '%'; if (text) s.textContent = text; },
      setTitle(x) { t.textContent = x; },
      setCancelable(fn) { cancel.hidden = false; cancel.onclick = () => { cancelled = true; s.textContent = '正在取消…'; if (fn) fn(); }; },
      get cancelled() { return cancelled; },
      close() { el.hidden = true; }
    };
  };

  Z.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('zy.' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('zy.' + key, JSON.stringify(value)); } catch (e) {}
    },
    del(key) { try { localStorage.removeItem('zy.' + key); } catch (e) {} }
  };

  Z.download = function (name, data, mime = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  Z.copy = async function (text) {
    try { await navigator.clipboard.writeText(text); Z.toast('已复制', 'ok'); }
    catch (e) { Z.toast('复制失败，请手动选择文本', 'error'); }
  };

  Z.url = function (path) {
    return new URL(path, document.baseURI).href;
  };

  Z.fmtDate = function (ts) {
    const d = new Date(ts || Date.now());
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  Z.relTime = function (ts) {
    const diff = Date.now() - (ts || Date.now());
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + ' 分钟前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' 小时前';
    const d = Math.floor(h / 24);
    if (d < 30) return d + ' 天前';
    return Z.fmtDate(ts);
  };

  Z.bytes = function (n) {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  Z.escapeReg = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  Z.langOf = function (text) {
    const s = String(text || '');
    const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    if (/[\u3040-\u30ff]/.test(s) && cjk * 3 < latin) return 'ja';
    if (cjk >= latin * 0.6) return 'zh';
    return 'en';
  };

  Z.splitSentences = function (text) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    if (/[\u4e00-\u9fff]/.test(s)) {
      return s.split(/(?<=[。！？；])/).map((x) => x.trim()).filter(Boolean);
    }
    return s.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) || [s];
  };

  Z.truncate = function (s, n = 46) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };

  Z.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  Z.scrollIntoViewSoft = function (el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  };

  Z.attachAutoIcons = function () {
    Z.hydrateIcons(document);
  };

  document.addEventListener('DOMContentLoaded', Z.attachAutoIcons);
})(window.ZY);
