# 知忆 ZHIYI

把资料变成记得住的知识：导入 PDF / 图片 / Word / PPT / Markdown / TXT，自动拆解知识点、生成思维导图与双语对照，配合点词朗读、批注与间隔复习，形成「理解 → 练习 → 记住」的闭环。

在线体验：https://52ny.github.io/zhiyi/

## 功能

- 导入：PDF、图片 OCR、DOCX、PPTX、Markdown、TXT、粘贴文本；导入前可描述要提取的内容（正文/题目/公式/单词）并校对。
- 阅读：分块排版、点词查义与朗读、双语对照（英文 / 文言文 → 白话）、高亮与批注。
- 理解：知识点拆解、思维导图、费曼自检。
- 记忆：自测卡片、SM-2 间隔复习、词卡与学习统计。
- AI：内置智能体（免下载免 Key）、浏览器内离线小模型、在线知识库、自填云端 Key，四种来源可切换并自动降级。
- 本地优先：资料与进度存在 IndexedDB，不上传服务器；支持 JSON 导出/导入迁移。
- 演示模式：`?demo=1` 自动补齐示例资料，适合答辩与离线演示。

## 技术架构

纯静态站点，无后端、无构建产物依赖，浏览器直接运行原生 ES2020 脚本。

```
index.html            入口；第三方 UMD + 单一 ESM 入口
src/main.js           模块入口，按依赖顺序装配 assets/js
assets/js/            业务模块（IIFE 挂载到 window.ZY）
  db.js               IndexedDB 封装
  importer.js         解析、OCR、清洗、AI 校对
  reader.js           阅读器、双语、批注
  review.js           卡片与间隔复习
  ai.js               AI Provider 与降级策略
  app.js              路由与页面装配
assets/vendor/        第三方库（pdf.js、mammoth、jszip）
sw.js                 Service Worker（离线缓存）
manifest.webmanifest  PWA 清单
tests/                Vitest 单测（jsdom）
scripts/verify.mjs    工程校验（语法、资源引用、manifest、SW 清单）
docs/                 架构、测试、ADR 等文档
```

设计取舍见 [docs/adr/0001-static-first.md](docs/adr/0001-static-first.md)，详细说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 本地开发

需要 Node.js 20+。

```bash
npm ci
npm run dev        # http://127.0.0.1:8777
```

## 质量校验

```bash
npm run lint       # ESLint
npm test           # Vitest 单元测试
npm run verify     # JS 语法、资源引用、manifest 图标、SW 预缓存
npm run check      # 以上全部
```

CI 在每次 push / PR 执行 `npm run check`（见 `.github/workflows/ci.yml`）。

## 部署

仓库根目录即发布目录，GitHub Pages 直接托管静态文件。发布前执行：

```bash
npm run check
```

静态资源带 `?v=YYYYMMDD` 版本号，更新后同步修改 `index.html` 与 `sw.js` 的缓存版本。

## 目录规范

- 业务代码只放在 `assets/js/`，第三方库放 `assets/vendor/`，不要混放。
- 新增资源需同时加入 `sw.js` 预缓存清单，`npm run verify` 会校验。
- 提交信息遵循 `feat: / fix: / docs: / test: / chore:`。
- 详细协作方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 路线图

- [x] 单一 ESM 入口装配（src/main.js）
- [x] 单元测试与 CI
- [x] PWA 可安装与离线缓存
- [x] 演示模式与示例资料
- [ ] 核心模块迁移为 ES Module + JSDoc 类型检查
- [ ] Playwright 端到端测试（导入 → 阅读 → 复习）
- [ ] 可选账号与多端同步（Supabase，保持离线优先）
