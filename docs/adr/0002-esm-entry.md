# ADR 0002：以原生 ES Module 单一入口装配，暂不引入打包器

- 状态：已采纳
- 日期：2026-10-25

## 背景

项目此前在 `index.html` 中用 17 个 `<script>` 按顺序加载模块，依赖顺序靠人工维护，无法形成模块图，也难以做构建与按需加载。

## 决策

1. 新增 `src/main.js` 作为唯一入口，使用原生 ESM `import` 按依赖顺序装配现有模块。
2. `index.html` 仅保留第三方 UMD 库（pdf.js、mammoth、jszip）的普通脚本，业务代码统一由一个 `<script type="module">` 加载。
3. 现有模块暂保持 IIFE + `window.ZY` 形态，作为兼容层；后续按 `core → features` 顺序逐个改为 `export`。
4. 模块 URL 带 `?v=` 版本号，配合 Service Worker 版本更新。

## 理由

- 零构建即可部署，保持 GitHub Pages 直接托管与离线可用。
- 模块按 ESM 规则执行（严格模式、独立作用域），先暴露潜在问题。
- 为后续接入 Vite/打包、按需加载和单元测试铺路。

## 代价

- 浏览器需支持 ESM（现代浏览器均支持）。
- 首屏会发起多个模块请求（HTTP/2 下可接受），暂不做打包合并。

## 验证

- 本地与线上加载无控制台错误；`ZY.App.docs`、阅读页、复习页正常。
- `npm run check` 通过；`scripts/verify.mjs` 校验入口与资源存在。
