# 架构说明

## 总体形态

知忆是纯静态单页应用：浏览器加载 `index.html` 后按顺序装配 `assets/js` 中的模块，每个模块以 IIFE 形式挂到 `window.ZY` 命名空间下。无服务端依赖，数据保存在 IndexedDB，AI 能力可按来源切换。

```
浏览器
  ├─ UI 层：app.js（路由/装配）、reader.js、mindmap.js、lab.js、review.js、chat.js
  ├─ 业务层：importer.js、translate.js、annotate.js
  ├─ 基础层：db.js、util.js、store（localStorage）、tts.js
  └─ 能力层：ai.js（Provider 适配）、localai.js（浏览器内模型）、webkb.js（在线百科）
```

## 关键设计

### 1. 本地优先

- 文档、卡片、批注、翻译缓存全部存 IndexedDB；偏好设置存 localStorage。
- 无账号体系，换设备通过 JSON 导出/导入迁移。
- 隐私边界：除非用户主动使用 AI/在线知识库/免费翻译，资料不出浏览器。

### 2. AI Provider 与降级

`ai.js` 对外暴露统一接口（chat / translate / explain / mindmap / cards），内部按来源分派：

- `agent`：内置公共推理服务，多端点与多模型重试。
- `local`：Transformers.js + WebGPU/CPU，离线可用。
- `online`：百科检索 + 结构化，不做自由生成。
- `cloud`：用户自填 OpenAI 兼容接口。

失败策略：同类端点重试 → 换模型 → 换来源；仍失败时给出可操作提示，不阻塞阅读/复习等本地功能。

### 3. 导入流水线

解析（PDF/图片/Office/Markdown/TXT）→ OCR 预处理（放大、灰度、对比、锐化）→ 文本清洗（页码、广告、重复页眉）→ 按意图筛选（正文/题目/公式/单词）→ 校对（规则 + AI）→ 入库。

### 4. 复习调度

卡片使用 SM-2 变体：`interval`、`ease`、`reps`、`lapses`。评分影响下次到期时间，复习日志用于连续天数统计。

### 5. 离线与缓存

- Service Worker：导航请求网络优先，静态资源缓存优先。
- 静态资源通过 `?v=YYYYMMDD` 失效旧缓存；`sw.js` 的 `CACHE` 版本同步递增。
- PWA manifest 提供安装入口与图标。

## 数据模型（简化）

```js
Doc {
  id, title, type, lang, source, blocks[], translations{}, highlights[], cards[], meta{}, createdAt, updatedAt
}
Block { t: 'h1'|'h2'|'p'|'li', text, page }
Card  { id, kind:'qa'|'word', front, back, due, interval, ease, reps, lapses }
```

## 质量保障

- 单元测试：语言识别、文言判定、OCR 纠错、导入清洗、工具函数。
- 工程校验：JS 语法、HTML 资源引用、manifest 图标、SW 预缓存清单。
- CI：push / PR 执行 `npm run check`。

## 已知限制

- 无账号与多端同步。
- AI 公共端点无 SLA，演示需准备降级路径与备用视频。
- OCR 受图片质量限制，仍需人工校对。
