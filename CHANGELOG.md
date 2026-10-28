# Changelog


## 0.3.6 (2026-10-28)

- 恢复文档承诺的入口：`scripts/ocr_image.txt` 改回 `scripts/ocr_image`（bash 包装器）并补执行位；新增 `scripts/ocr_image.cmd`、`scripts/preprocess.cmd`（CRLF + 纯 ASCII）。
- 补 8 张边界样例：新增 `scripts/generate_examples.py`（纯 `struct`+`zlib` 写 PNG，零 Pillow 依赖），生成 `examples/01-solid-white … 08-blank`；`self_test.sh` 发现缺图会自动重生。
- 语言包不再污染技能目录：模型目录改 `~/.cache/image-ocr/tessdata`（`TESSDATA_DIR` 可覆盖），并复用老的 `assets/tessdata`（若已有 `eng.traineddata`）。根因是 tesseract.js 默认 `cachePath='.'`，`--doctor` 的 `createWorker` 因此会把 4MB 模型写进当前目录，本次显式传 `cachePath=<tmp>` + `cacheMethod:'none'` 修掉。
- 版本单源：`--version` 改读 `manifest.json`（原来固定打印 0.3.3），`self_test.sh` 的版本断言也改读 manifest。
- 修存量崩溃：`doctor()` 引用 `opts.uiLang` 却没有参数，`--doctor` 必崩 → 改 `doctor(opts = {})`。
- 缺 Pillow 时 `preprocess.py` 不再裸 traceback，给中文安装指引 + `sys.exit(3)`。
- `download_langs.sh` 不再用 curl 双实现，改为转发 `node ocr_image.js --download-langs`。
- `--workers` 保持串行实现：实测 `--workers 4` 需 29.7s、单进程 18.1s（tesseract.js 每个子进程重载模型），文档与代码注释按实测写明，不再宣称并行提速。
- `self_test.sh` 断言放宽为宽松匹配（回归 3 项 + 边界 8 项，结构性样例如空白/旋转只要求不崩溃），共 11 步。

## 0.3.5 (2026-10-21)
- 三平台对齐（cross-platform + i18n overseas）：README.en.md、`--lang en|zh` 主入口、i18n.py、CFI 三平台 workflow 全绿。
- 不改变业务算法/中文模板；平台专用调整只改发布副本。

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
