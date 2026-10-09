# Changelog

## 0.2.0 — 2026-10-09

- 目标定位扩展为通用图片/文书 OCR：不限于建筑图纸，可识别中文、英文、日文、韩文、俄文、阿拉伯文、希伯来文字，图片/PDF/书页照片均可。
- 新增多语言能力：字符集自动检测（日/韩/俄/阿/希伯来/英）、`--lang-list`、`--download-langs a,b` 联网下载 `tessdata_fast` 模型、`--auto-download` 默认开启按需自动补装语言包。
- 新增系统语言自动匹配（macOS / Linux / Windows）：未显式指定 `--lang` 时按系统语言选模型，并预装历史常用语言。
- 新增结构化输出：`--table`（Markdown 表格）、`--csv`（UTF-8 BOM，Excel 直接打开不乱码）、`--out 文件`。
- 新增可靠性：5 分钟磁盘缓存、低置信度行 `uncertain`/`需核对` 标记、`--auto-retry` 自动重试、EXIF 方向自动校正、`--auto-rotate`。
- 新增 PDF/书页增强：`--page N`、`--max-pages N`、`--dpi N`（默认 200，低清书页可用 300/400），多页 PDF 按页码数值排序（修复第10页排到第2页前的旧问题）。
- 新增 `--code` 代码/报错截图模式（保留缩进、空格，中文注释间距不破坏）。
- 新增 `scripts/download_langs.sh` 语言包下载器（带失败清理)。
- 完整包附带 `jpn` 模型；`NOTICE.md` 更新来源声明。
- 内部资料默认仅走本地 OCR，文档明确不回传云端视觉服务。

## 0.1.1 — 2026-08-30

- 纠正语言模型来源声明：包内模型是 tesseract.js 官方 `@tesseract.js-data` 的 `4.0.0_best_int` 文件（SHA-256 已核对，见 `NOTICE.md`），不是 tessdata_fast，许可以前为 Apache-2.0 的说法有误。
- SkillHub 首次安装下载模型改用与测试完全一致的文件地址（jsDelivr + gunzip），并给出可校验的字节数。

## 0.1.0 — 2026-08-30

首次公开发布。

- 本地离线 OCR 命令行：图片、多图片、多页 PDF 一次调用，模型只加载一次。
- 语言：`chi_sim`（中英混排+数字）、`eng`；模型随包，不联网下载。
- 预处理：灰度 + 自动对比度；小图（<=800px）自动 2x；可选 `--deskew`（±5° 纠偏）、`--binarize`（Otsu）、`--upscale`（强制放大）。
- 选项：`--psm auto|sparse|block|line`、`--whitelist` 字符白名单（算式/数字专用）、`--json` 逐行坐标。
- 中文之间多余空格在文本模式下自动清理。
- PDF：优先 `pdftoppm` 200 DPI 全页；无 poppler 时 `sips` 只处理第 1 页并给出提示。
- 启动器 `scripts/ocr_image.sh` 自动定位 node/python，并过滤 tesseract wasm 进度噪声。
- 实测：3 行小图 0.6 秒；1200×1600 30 行整页 2.9 秒。
