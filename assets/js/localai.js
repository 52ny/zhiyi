/* 知忆 · 浏览器内 AI（Transformers.js + WebGPU/WASM，模型按需下载并缓存） */
(function (Z) {
  const MODELS = [
    { id: 'onnx-community/Qwen2.5-0.5B-Instruct', name: 'Qwen2.5 0.5B', size: '约 480MB', hint: '轻量，中文可用，普通电脑即可' },
    { id: 'onnx-community/Qwen2.5-1.5B-Instruct', name: 'Qwen2.5 1.5B', size: '约 1.2GB', hint: '讲解更完整，建议独显或高性能核显' }
  ];
  const MIRROR = 'https://hf-mirror.com';
  const state = {
    lib: null,
    pipe: null,
    modelId: MODELS[0].id,
    device: '',
    loading: false,
    ready: false,
    progress: 0,
    status: '',
    error: '',
    onProgress: null
  };

  function emit(patch) {
    Object.assign(state, patch || {});
    if (typeof state.onProgress === 'function') {
      try { state.onProgress(snapshot()); } catch (e) {}
    }
  }

  function snapshot() {
    return {
      loading: state.loading, ready: state.ready, device: state.device,
      progress: state.progress, status: state.status, error: state.error,
      modelId: state.modelId, model: MODELS.find((m) => m.id === state.modelId) || MODELS[0]
    };
  }

  async function detectDevice() {
    if (!('gpu' in navigator)) return 'wasm';
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter ? 'webgpu' : 'wasm';
    } catch (e) { return 'wasm'; }
  }

  function mirrorHost() {
    return String(Z.store.get('local.mirror', MIRROR) || MIRROR).trim().replace(/\/+$/, '');
  }

  async function ensureLib() {
    if (state.lib) return state.lib;
    emit({ status: '正在载入推理引擎…' });
    const url = Z.url('assets/vendor/transformers/transformers.min.js');
    const lib = await import(url);
    lib.env.allowLocalModels = false;
    lib.env.allowRemoteModels = true;
    lib.env.useBrowserCache = true;
    lib.env.remoteHost = mirrorHost();
    lib.env.remotePathTemplate = '{model}/resolve/{revision}/';
    if (lib.env.backends?.onnx?.wasm) {
      lib.env.backends.onnx.wasm.wasmPaths = Z.url('assets/vendor/transformers/');
      lib.env.backends.onnx.wasm.numThreads = 1;
    }
    state.lib = lib;
    return lib;
  }

  async function load(modelId, forceDevice) {
    if (state.loading) return snapshot();
    if (state.ready && state.modelId === (modelId || state.modelId)) return snapshot();
    state.modelId = modelId || state.modelId;
    emit({ loading: true, ready: false, error: '', progress: 0, status: '检测运行设备…' });
    try {
      const lib = await ensureLib();
      const device = forceDevice || await detectDevice();
      emit({ device, status: device === 'webgpu' ? '使用 GPU 加速' : '使用 CPU 推理（较慢）' });

      if (state.pipe && typeof state.pipe.dispose === 'function') {
        try { await state.pipe.dispose(); } catch (e) {}
      }
      state.pipe = null;

      const dtype = device === 'webgpu' ? 'q4f16' : 'q8';
      const pipe = await lib.pipeline('text-generation', state.modelId, {
        dtype,
        device,
        progress_callback: (p) => {
          if (!p) return;
          if (p.status === 'progress' && p.total) {
            const pct = Math.min(99, Math.round((p.loaded / p.total) * 100));
            emit({ progress: pct, status: `下载 ${(p.file || '').split('/').pop()} · ${pct}%` });
          } else if (p.status === 'done') {
            emit({ status: '校验模型文件…' });
          } else if (p.status === 'ready') {
            emit({ status: '初始化模型…' });
          }
        }
      });
      state.pipe = pipe;
      emit({ loading: false, ready: true, progress: 100, status: device === 'webgpu' ? 'GPU 就绪' : 'CPU 就绪' });
      try { navigator.storage?.persist?.(); } catch (e) {}
    } catch (err) {
      const msg = String(err?.message || err);
      const netFail = /fetch|Network|Failed|CORS|ERR_/i.test(msg);
      emit({
        loading: false, ready: false, error: msg,
        status: netFail
          ? '无法访问模型源（网络或跨域限制），可在下方更换镜像，或改用云端 AI'
          : '模型加载失败：' + msg.slice(0, 120)
      });
    }
    return snapshot();
  }

  async function unload() {
    if (state.pipe && typeof state.pipe.dispose === 'function') {
      try { await state.pipe.dispose(); } catch (e) {}
    }
    state.pipe = null;
    emit({ ready: false, progress: 0, status: '已卸载', error: '' });
  }

  function pickText(out) {
    if (!out) return '';
    const first = Array.isArray(out) ? out[0] : out;
    if (!first) return '';
    const g = first.generated_text;
    if (typeof g === 'string') return g;
    if (Array.isArray(g)) {
      const last = g[g.length - 1];
      return typeof last === 'string' ? last : (last?.content || '');
    }
    if (g && typeof g === 'object') return g.content || '';
    return '';
  }

  async function chat(messages, opts = {}) {
    if (!state.ready || !state.pipe) throw new Error('本地模型尚未加载');
    const out = await state.pipe(messages, {
      max_new_tokens: opts.maxTokens || 900,
      do_sample: opts.temperature > 0,
      temperature: opts.temperature || 0.5,
      top_p: 0.9,
      repetition_penalty: 1.05,
      return_full_text: false
    });
    const text = pickText(out).trim();
    if (!text) throw new Error('模型没有返回内容，请重试');
    return text;
  }

  Z.LocalAI = {
    MODELS, MIRROR, mirrorHost,
    get ready() { return state.ready; },
    get loading() { return state.loading; },
    get device() { return state.device; },
    snapshot,
    load,
    unload,
    chat,
    setProgressHandler(fn) { state.onProgress = fn; },
    detectDevice
  };
})(window.ZY);
