---
name: image-ocr
slug: image-ocr
displayName: 图片文字识别 / Image OCR
version: 0.2.0
author: lis
license: CC-BY-NC-SA-4.0
description: Read text, numbers, and math expressions from image files using local OCR (chi_sim/eng), fully offline. Use whenever the user attaches an image or a scanned/multi-page PDF and asks what it says, wants content extracted, needs a worksheet or questions read from a photo, or wants image text converted to editable text. Accepts several images or PDFs in one call. Also use to preprocess low-quality images before OCR. Provides text extraction only, not scene understanding.
---

# Image OCR

本地离线的图片/PDF 文字识别：把图片、截图、扫描件和多页 PDF 里的文字、数字、算式提取成可编辑文本。图片字节只在本机处理，不上传、不调用云端视觉接口。

适用场景：文书/票据/截图/试卷/图纸说明/书页照片的文字提取。
不适用场景：可直接复制文字的网页、Word/PDF 原文（直接复制即可，不要走 OCR）；手写、模糊照片、复杂版面准确率不保证。

## 快速开始

一条命令，图片和 PDF 可以混在同一批：

`node <skill>/scripts/ocr_image.js <图片路径> [更多图片/scan.pdf ...]`

直接可执行版启动器（自动定位 node/python，过滤引擎进度噪声）：

`bash <skill>/scripts/ocr_image.sh <图片路径> [更多文件 ...]`

stdout 只输出识别文字；低置信度行会写 stderr 并标记「需核对」。

## 依赖

- Node.js，一次安装：`cd <skill>/scripts && npm install tesseract.js@7`
- Python 3 + Pillow（预处理）：`python3 -m pip install Pillow`
- 多页 PDF 需要 poppler（`pdftoppm`）；没有时仅能转第 1 页（macOS `sips` 回退）
- 语言模型：完整包内置 `chi_sim`/`eng`；需要日/韩/俄/阿/希伯来等更多语言时用 `--download-langs a,b` 联网下载

## 选项

- `--lang chi_sim|eng` — 默认 `chi_sim`（中文+数字）。不要写 `chi_sim+eng`；tesseract.js 7 的多语言初始化不支持。
- `--psm auto|sparse|block|line` — 页面分割模式。
- `--whitelist "0123456789+-x×÷=()"` — 只识别指定字符，适合算式/数字。
- 预处理默认开启：灰度 + 自动对比度 + 小图(<=800px)自动 2x。
- `--no-preprocess` — 用原像素识别。`--upscale` — 强制 2x。
- `--deskew` — 倾斜 ±5° 校正，适合手持拍照。`--binarize` — Otsu 二值化，适合低对比扫描。
- `--json` — 逐行坐标 + 置信度 + `uncertain` 标记；`--table` — Markdown 表格；`--csv` — CSV（Excel 不乱码）。
- `--out 文件` — 结果写文件代替 stdout。
- `--auto-retry`（默认开）— 低置信度自动重试二值化/纠偏；`--no-auto-retry` 关闭。
- `--auto-rotate` — 首轮结果差时尝试 90/180/270 旋转（适合手机照片）。
- `--page N` / `--max-pages N` / `--dpi N` — PDF 页选择、页数上限、渲染分辨率（默认 200，低清书页用 300/400）。
- `--auto-lang`（默认开）— 首轮像英数时自动用 `eng` 重试；`--no-auto-lang` 关闭。
- `--code` — 代码/报错截图模式：保留缩进和空格。
- `--lang-list` — 列出已安装语言模型。
- `--download-langs a,b` — 联网下载 tessdata_fast 语言包。
- `--auto-download`（默认开）— 缺模型时按系统语言/识别需求自动下载；`--no-auto-download` 关闭。
- 未显式 `--lang` 时按系统语言自动选模型（macOS / Linux / Windows；见 README 的"系统语言匹配"）。

## 工作流

1. 先用默认参数直接跑；效果差再依次 `--psm sparse` → `--deskew`/`--binarize` → `--upscale`。
2. 中文+数字：默认 `chi_sim`（文本模式清理中文间空格；`--json` 保留原文）。
3. 纯英文/数字：`--lang eng`。
4. 多图或多 PDF 一次调用更省时——模型只加载一次。
5. 手写、模糊照片、低清扫描不可靠；必须如实告诉用户哪些能读、哪些读不了，不得编造。
6. 内部资料默认走本地 OCR；除非用户明确同意，不转给云端视觉服务。

## 资源

- `scripts/ocr_image.js` — OCR 主程序
- `scripts/ocr_image.sh` — 启动器（自动定位 node/python，过滤进度噪声）
- `scripts/preprocess.py` — 预处理（灰度/对比度/放大/纠偏/Otsu/旋转）
- `scripts/download_langs.sh` — 附加语言模型下载
- `assets/tessdata/` — 离线模型 `chi_sim`/`eng`/`jpn`（来源与许可见 NOTICE.md）

## 缓存/可靠性

- 同一文件 5 分钟内的重复识别走磁盘缓存，秒回且稳定。
- 自动预装系统语言 + 历史常用语言；`prefs.json` 记录历史语言。
- 低置信行输出 `warn: ... 需核对`，不污染纯文本输出。
- 启动器会在缺模型、缺 tesseract.js、缺 pdftoppm、格式不支持时给出中文指引。
