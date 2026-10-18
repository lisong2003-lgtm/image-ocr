# CHANGELOG

## v0.3.3 (2026-10-18)
- 自检升级：`scripts/self_test.sh` 扩展为 3 项回归 + 8 项边界样例（更难手写体、严重模糊、低分辨率、印章压字、竖排/异体字、复杂合并表格 ×2），全部通过才写通过记录；通过日志规范路径 `/tmp/image_ocr_selftest_0.3.3.log`。
- v0.3.2 仅有 2 项边界样例；v0.3.3 新增 6 张更难边界样例与 expected：`example-handwriting-hard`、`example-blur-heavy`、`example-lowres`、`example-stamp-overlap`、`example-vertical-cn`、`example-merged-table-complex`。
- 边界行为增强：低置信/整体读不到时，标准输出必须带【需人工核对】+ 证据（行号/conf/裁剪区域），不把草稿结论当成功；空结果与整体低置信也会触发需人工核对，不再静默返回空文本。
- 补齐 `README.md` 与 `CHANGELOG.md`；`BENCHMARK.md` 同步 8 项边界说明。
- 发布合规：SkillHub 轻量包不含 `.traineddata` 二进制（模型一次性下载，见 README 双包说明），GitHub 完整包含模型二进制；本机原版保持完整。

## v0.3.2 (2026-10-18，已先行发布的最小边界版)
- 新增 `examples/example-handwriting.png`、`examples/example-merged-table.png` 两个边界样例与 expected：手写体/复杂合并表格一律标【需人工核对】，不假装识别成功；`scripts/self_test.sh` 为 3 项回归 + 2 项边界样例。（本机继续演进为 v0.3.3 的 8 项边界。）

## v0.3.1 (2026-10-14)
- 结构化抽取 `--fields date,amount,id`（只抽实际读到内容，读不到留空，不补全）。
- `--crop-preview` 保存裁剪预览并输出路径。
- 复杂表格列合并/跨行留给 `--json` + 人工核对，不做自动重建工作簿。
- 语言模型下载镜像 `TESSDATA_BASE_URL` 可切换；下载改为纯 Node。
- 帮助文本与错误处理补充中文后续操作；`--quiet` 保留低置信告警。

## v0.3.0 (2026-08-30)
- 首版：本地 tesseract.js wasm OCR，支持 PNG/JPG/WebP/GIF/BMP/TIFF/PDF（pdftoppm），中英/多语言。
- `--doctor`、`--version`、`--crop`、`--deskew`、`--binarize`、`--auto-retry`、`--auto-rotate`、`--table`/`--csv`/`--code`/`--json`、批量 `--workers/--progress/--resume`、缓存管理。
- 手写/复杂合并/低对比边界开始标注需人工核对，不自动补全。
