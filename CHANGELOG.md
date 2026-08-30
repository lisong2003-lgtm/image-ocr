# Changelog

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
