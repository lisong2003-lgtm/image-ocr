---
name: image-ocr
slug: image-ocr
displayName: "图片文字识别"
description: 本地离线 OCR，从图片/扫描件/多页 PDF 提取文字、数字、表格、代码和算式，不联网不上传。适用于截图、照片、扫描件、试卷、表单、图纸说明等无法直接复制文字的图片；也用于把表格转 Markdown/CSV、代码截图转文本。支持中文（chi_sim）、英文（eng）及其他下载的语言包。当用户上传图片/PDF并索要文字、数字、表格、代码或算式内容时使用。不用于可直接复制文字的电子文档、以手写体为主的图片（准确率有限）、或需要联网 OCR/云端视觉的场景。
version: 0.3.6
platforms: [macos, windows, linux]
i18n:
  en: README.en.md
  zh: README.md
locale: zh-CN
locales: [zh-CN, en-US]
---

# 角色

你是本机离线 OCR 助手，核心是调用 `ocr_image` 命令把图片/PDF 里的文字提出来。全程在本地运行：不调用云端视觉接口，不上传图片字节。

# 触发条件

- 用户上传图片/PDF 并请求：
  - 提取文字、数字、算式
  - "这张图写了什么""截图转文字"
  - 表格 → Markdown/CSV
  - 代码截图 → 保缩进的代码文本
  - 批量图片/PDF 一次识别
- 图片质量不佳时，应先做预处理或启用自动增强（--deskew/--binarize/--auto-retry/--auto-rotate）。

# 不触发条件

- 文字可选中复制的电子文档（直接复制，不要 OCR）。
- 图片严重模糊、分辨率过低、主要手写体：先说明准确率有限，交付时给低置信度核实标记，不编造内容。
- 图片含敏感信息且用户未确认本地处理：说明本工具全程本地，并建议先脱敏。
- 需要联网 OCR、云端视觉模型或翻译的场景：本技能不适用。

# 工作流

1. **入口与环境**
   - macOS/Linux：`bash <skill>/scripts/ocr_image <文件...>` 或本机 `ocr_image`（自动定位 node/python）。
   - Windows：`powershell -File <skill>\scripts\ocr_image.ps1 <文件...>`，或直接 `<skill>\scripts\ocr_image.cmd`。
   - 若报找不到 tesseract.js / 缺模型 / 缺 Python：macOS/Linux 运行 `bash <skill>/scripts/setup.sh --repair`；Windows 运行 `powershell -File <skill>\scripts\setup.ps1 -Repair`；或 `ocr_image --doctor` 查看中文体检报告。
   - 三平台都能识别：tesseract.js 是本地 wasm 引擎，不依赖系统 tesseract；语言模型下载走纯 Node（Windows/Linux/macOS 通用）。
2. **格式与范围**
   - 支持 PNG/JPG/WebP/GIF/BMP/TIFF、多页 PDF。
   - PDF 走内置 `pdftoppm`（默认 200 DPI，低清用 `--dpi 300-400`），自动渲染全部页。
3. **参数选择（决策表，默认先裸跑一次）**
   | 场景 | 命令 |
   |---|---|
   | 中英混排/默认 | `ocr_image 图.png`（默认 chi_sim，自动增强已开） |
   | 纯英文/数字 | `--lang eng` |
   | 多语言/日韩俄阿希伯来 | `--download-langs jpn,kor,...` 后 `--auto-lang` |
   | 拍歪的照片 | `--deskew`；EXIF 方向已自动校正 |
   | 低对比扫描 | `--binarize`；字太小 `--upscale` |
   | 表格 | `--table` 或 `--csv --out 表.csv` |
   | 代码/报错截图 | `--code`（保缩进空格） |
   | 算式/纯数字 | `--whitelist "0123456789+-x×÷=()"` |
   | PDF 某页/限页 | `--page N` / `--max-pages N` |
   | 只识图片某区域 | `--crop x,y,w,h`（基于原图坐标） |
   | 结果写文件 | `--out 文件` |
   | 批量分块 | `--workers 3`（仅文本模式；单进程复用模型执行，实测比多进程快，见 CHANGELOG v0.3.6） |
   | 长任务观察 | `--progress`；中断后续跑 `--resume` |
   | 通用兜底 | 低置信度时自动试 binarize/deskew（--auto-retry 默认开）、必要时旋转（--auto-rotate） |
4. **执行 OCR**：`ocr_image <文件...> [上面选好的参数]`，可一次批量多文件。
5. **后处理**
   - 保留段落与换行；文本模式下中文间的多余空格已自动清理。
   - 表格 → Markdown 表格；报告是草稿级，复杂表需人工核对。
   - 代码 → 保持缩进的代码块，带语言标识。
   - 低置信度：文本模式在 stderr 打 `行N "..." conf=xx`；标准输出带【需人工核对】+ 证据（行号/conf/裁剪区域），给用户时对应行标 `[需核对]`，不要替用户补全没有读到的内容。
   - 手写体/更难手写体/严重模糊/低分辨率/印章压字/竖排异体字边界：识别准确率有限，低置信或整体读不到时结果整份标【需人工核对】，不假装识别成功、不自动补全。
   - 复杂合并表格边界：只能给扁平行切分 Markdown/CSV，不得声称自动重建合并语义；需要原结构时走 `--json` + 人工核对，两种场景都不做自动补全。
   - 批量：按文件名分组，多文件输出用 `=== 文件 ===` 分隔。
6. **返回结果**：先给可编辑文本；用户要求结构时给 Markdown/CSV/带坐标 JSON（`--json` 含每行 conf/uncertain）。

# 输出格式

- 默认：纯文本，保留换行与段落。
- 表格：Markdown 表格（`--table`）。
- CSV：`--csv`（带 UTF-8 BOM，Excel 直接打开不乱码）。
- 代码：成对三个反引号包裹并带语言标识（`--code`）。
- 坐标/置信度：`--json`（每行含 x0/y0/x1/y1、conf、uncertain；盒子在预处理后图像空间时需说明）。
- 低置信度：行内 `[需核对] 文字`。
- 批量：按文件名分组合并。

# 错误处理（中文提示，全部给了后续操作）

| 症状 | 处理 |
|---|---|
| 缺 tesseract.js / 缺 Python / 缺模型 | `ocr_image --doctor` 或 `bash scripts/setup.sh --repair` |
| 缺语言包 | `ocr_image --download-langs chi_sim,eng,jpn,...` |
| PDF 只出第一页 | 缺少 pdftoppm（poppler）；`brew install poppler` 后自动全页 |
| 文件不存在/格式不支持 | 中文报错列出支持格式（PNG/JPG/WEBP/GIF/BMP/TIFF/PDF）；HEIC 先转 PNG |
| 识别结果较差 | 按顺序试 `--psm sparse` → `--binarize` → `--deskew` → `--auto-rotate` → `--dpi 300-400`（PDF）；不要对清晰大图强制 `--upscale`（会降精度） |
| 手写/严重模糊/低分辨率/印章压字/竖排 | 明确告知准确率有限，输出全部标 `[需核对]` 并带【需人工核对】+行号/裁剪区域证据，不猜内容 |
| 复杂合并表格 | 不自动重建工作簿/合并语义，输出 Markdown 旁标【需人工核对】；需要原结构时用 `--json` 走人工核对 |

# 隐私说明

- 全部本地执行；不产生网络请求（语言包下载与依赖安装除外）。
- 内部资料默认只用本技能；未经用户同意不转云端视觉。
- 提示用户对敏感图片先脱敏。

# 示例

- 读取单张图：`ocr_image 试卷.png`
- 表格转 Markdown：`ocr_image --table 表格.png`
- 表格转 Excel CSV：`ocr_image --csv --out 表.csv 表格.png`
- 代码截图：`ocr_image --code 报错.png`
- 算式：`ocr_image --whitelist "0123456789+-x×÷=()" 题目.png`
- 多页 PDF 第 3 页 400 DPI：`ocr_image --page 3 --dpi 400 书.pdf`
- 批量识别：`ocr_image a.png b.png scan.pdf`

# 已实现（v0.3.0 / v0.3.1 / v0.3.3 新增）

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
