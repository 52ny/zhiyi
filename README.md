# 知忆 ZHIYI

把资料变成记得住的知识。纯静态、本地优先的学习工作台，无需构建，直接部署到 GitHub Pages。

## 功能

- **导入**：PDF、图片（OCR）、DOCX、PPTX、Markdown、TXT、HTML，或直接粘贴文本
- **阅读**：双语对照、点词朗读与查词、四色高亮与笔记、整段朗读、专注模式
- **思维导图**：自动从文档结构生成，可增删改、折叠、回忆模式、导出 SVG/PNG
- **手绘批注**：PDF / 图片 / 文本上钢笔、荧光笔、橡皮，笔画存本机
- **复习**：抽认卡与 SM-2 间隔重复，支持单词、问答、填空、翻译四类卡片
- **知识工坊**：输入知识点，得到定义拆解、直观理解、条件、误区、变式、拓展、自测与费曼自检
- **外观**：纸白 / 夜色两种主题，五种色系

## 隐私

所有资料、批注与卡片保存在浏览器 IndexedDB。文件解析、OCR、语音都在本机完成。
仅当使用 AI 增强或在线翻译时才联网。

## 本地运行

```bash
python -m http.server 8000
```

然后打开 http://localhost:8000

## 目录

```
index.html
assets/
  css/app.css
  js/            # 各功能模块，按依赖顺序在 index.html 中加载
  data/knowledge.js  # 内置知识点库
  vendor/        # pdf.js、mammoth、jszip、tesseract（本地化，无外链）
```

## AI（可选）

设置页填入 DeepSeek / OpenAI / 任意 OpenAI 兼容接口的 Base URL、模型与 API Key。
不配置时，翻译走免费接口，其余功能完全离线可用。

## 快捷键

`U` 导入 · `Space` 翻卡 · `1–4` 评分 · `Esc` 退出专注模式
