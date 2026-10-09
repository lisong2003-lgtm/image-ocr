# Image OCR（图片文字识别）

一个纯本地、离线的 OCR Skill：把图片、截图、扫描件和多页 PDF 里的中文、英文、数字、算式提取成可编辑文本。图片字节不上传、不调用云端视觉接口，适合处理内部资料、证件扫描件、图纸说明、试卷和聊天记录截图。

> 本包是供 AI 编码助手（Codex / Claude Code / 兼容 Agent）调用的工具型 Skill，不扮演任何人物或外部产品身份；被询问时应如实说明自己是 AI 助手。

## 它做什么 / 不做什么

- 做：图片/扫描件/PDF 的文字提取、纸质文书数字提取、表格→Markdown/CSV、代码截图保缩进、低清书页提高渲染 DPI。
- 不做：场景理解（不描述"图里有什么"）、手写识别保证、翻译和复杂版面重排。
- 不做（触发边界）：能直接复制文本的页面请直接复制，不要走 OCR。

## 安装

```bash
# 1. 放到技能目录（Codex 默认技能根目录）
cp -R image-ocr "$CODEX_HOME/skills/"

# 2. 装依赖（一次性）
cd "$CODEX_HOME/skills/image-ocr/scripts" && npm install tesseract.js@7
python3 -m pip install Pillow

# 3. 多页 PDF 需要 poppler（可选，缺失时只识别第 1 页）
brew install poppler
```

完整包内置 `chi_sim`/`eng`/`jpn` 模型，运行不联网。更多语言用 `bash scripts/download_langs.sh jpn,kor,rus` 或 `--download-langs a,b` 下载（需网络）。

> 版本差异：GitHub 完整包内置半离线模型；SkillHub 版受平台限制不含 `assets/tessdata/`，需按其 README 一次性下载，功能一致。

## 使用

```bash
# 单张或多张、PDF 混合，一次调用复用同一个模型实例
node "$CODEX_HOME/skills/image-ocr/scripts/ocr_image.js" 试卷.png 扫描.pdf

# 也可用启动器（自动定位 node/python）
bash "$CODEX_HOME/skills/image-ocr/scripts/ocr_image.sh" 图片.jpg

# 只识别数字和算式
.../ocr_image.js --whitelist "0123456789+-x×÷=()" 题目.png

# 拍歪的照片
.../ocr_image.js --deskew 现场照片.jpg

# 手机竖拍（EXIF 自动校正，必要时自动转 90/180/270）
.../ocr_image.js --auto-rotate 照片.jpg

# 表格 → Markdown
.../ocr_image.js --table 表格.png

# 表格 → CSV（Excel 不乱码）
.../ocr_image.js --csv --out 表格.csv 表格.png

# 多页 PDF 第 3 页，400 DPI 低清书页
.../ocr_image.js --page 3 --dpi 400 书页.pdf

# 列出/下载语言模型
.../ocr_image.js --lang-list
.../ocr_image.js --download-langs jpn,kor,rus
```

`--lang` 未指定时，会自动按系统语言选模型（macOS/Linux/Windows 均支持），并自动下载缺失的常用语言。

## 系统语言匹配

- macOS：读取 `AppleLanguages` / `AppleLocale`（zh→chi_sim, ja→jpn, ko→kor, ru→rus, en→eng 等）。
- Linux/BSD：读取 `LC_ALL`/`LC_MESSAGES`/`LANG`。Windows：读取 PowerShell `(Get-Culture).Name`。
- 安装后首次运行会预装系统语言 + 历史常用语言（`prefs.json` 记录），无需每次手动指定。

## 全本地、无云端

本技能只用本机 Tesseract（tesseract.js）和 Pillow，不调用云端视觉模型。内部资料请直接使用本技能，除非用户明确同意，不转给云端服务。

## 效果调优顺序

默认参数先跑 → `--psm sparse` → `--deskew`/`--binarize` → `--upscale`。对清晰大截图不要强制 `--upscale`（实测会降精度）。

## 目录结构

```
image-ocr/
├── SKILL.md              Agent 调用说明
├── README.md             本文件
├── CHANGELOG.md
├── LICENSE.md            CC BY-NC-SA 4.0（代码与文档）
├── NOTICE.md             语言模型第三方声明
├── manifest.json
├── agents/openai.yaml    界面元数据
├── scripts/
│   ├── ocr_image.js      CLI 主程序（tesseract.js 7）
│   ├── ocr_image.sh      启动器（自动定位 node/python，过滤进度噪声）
│   ├── download_langs.sh 语言包下载
│   └── preprocess.py     预处理（灰度/对比度/放大/纠偏/Otsu/旋转）
└── assets/tessdata/      离线模型（chi_sim/eng/jpn，来源见 NOTICE.md）
```

## 许可与隐私

- 代码与文档：CC BY-NC-SA 4.0，见 `LICENSE.md`。
- 语言模型：第三方文件（tesseract.js `4.0.0_best_int` + tessdata_fast，来源与许可见 `NOTICE.md`）。
- 全程本地运行，不产生网络请求（依赖安装与扩展语言包下载除外）。

## 反馈

问题和使用建议请留言，注明系统、图片类型和命令参数。
