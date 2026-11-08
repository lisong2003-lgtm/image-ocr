# 功能清单（原 SKILL.md 末尾内容）

- `--doctor`：本机 OCR 环境体检（含微型自检识别）。
- `--version`：输出版本号。
- `--quiet`：抑制 summary 等提示（保留低置信度核对警告）。
- `--crop x,y,w,h`：只识别原图指定区域（先裁剪再其他预处理）。
- `scripts/setup.sh`：依赖体检/`--repair` 一键补装。
- HEIC 输入自动转 PNG（macOS sips；Windows/Linux 用 ImageMagick 或 heif-convert，缺失时给中文提示）。
- 批量与性能：`--workers N` 分批（仅文本模式；v0.3.6 实测多进程重复加载模型反而慢 60%，故单进程内复用 worker 串行处理）、`--progress` 进度、`--resume` 断点续跑。
- 缓存管理：`--cache-ttl 秒`、`--no-cache`、`--clear-cache`。
- 表格增强：`--table-gap N` 调列切分、`--table-conf` 输出附每格置信度；复杂合并单元格必须标"需人工核对"。
- 结构化字段：`--fields date,amount,id` 输出 JSON，只抽实际读到的内容，读不到留空，不补全。
- `--crop-preview`：保存裁剪预览图并输出路径（临时/缓存目录）。
- 语言模型镜像：设 `TESSDATA_BASE_URL` 可切换下载源，例如 `TESSDATA_BASE_URL=https://你的镜像/tessdata_fast/main ocr_image --download-langs chi_sim,eng`；默认源不变。
- 跨平台：Windows 提供 `ocr_image.ps1` / `ocr_image.cmd` / `setup.ps1`；Linux/macOS 用 `ocr_image` 与 `setup.sh`；语言模型下载改为纯 Node，不依赖 bash/curl。
- PDF 渲染优先 pdftoppm（三平台），缺失时 macOS sips / 其他系统 ImageMagick 兜底第 1 页并提示装 poppler。
- 复杂表格的"列合并/跨行"留给 `--json` + 人工核对，不做自动重建工作簿。
- v0.3.3：新增 6 张更难边界样例与 expected——更难手写体、严重模糊、低分辨率、印章压字、竖排/异体字、复杂合并表格（跨列+跨行）——与原有 2 张共 8 张边界样例；`scripts/self_test.sh` 升级为 3 项回归 + 8 项边界样例，全部 PASS 才写通过记录；低置信/整体读不到时标准输出必须带【需人工核对】+ 行号/裁剪区域证据；补齐 `README.md`、`CHANGELOG.md` 与双包说明。
- 公式仅支持数字与符号片段（`--whitelist`），不支持完整 LaTeX 版面识别；需要时标注为待扩展。
