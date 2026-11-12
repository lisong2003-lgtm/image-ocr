# image-ocr 错误处理

> 从 SKILL.md 外移，内容与 v0.4.0 原表一致；按症状查处理动作。

| 症状 | 处理 |
|---|---|
| 缺 tesseract.js / 缺 Python / 缺模型 | `ocr_image --doctor` 或 `bash scripts/setup.sh --repair` |
| 缺语言包 | `ocr_image --download-langs chi_sim,eng,jpn,...` |
| PDF 只出第一页 | 缺少 pdftoppm（poppler）；`brew install poppler` 后自动全页 |
| 文件不存在/格式不支持 | 中文报错列出支持格式（PNG/JPG/WEBP/GIF/BMP/TIFF/PDF）；HEIC 先转 PNG |
| 识别结果较差 | 按顺序试 `--psm sparse` → `--binarize` → `--deskew` → `--auto-rotate` → `--dpi 300-400`（PDF）；不要对清晰大图强制 `--upscale`（会降精度） |
| 手写/严重模糊/低分辨率/印章压字/竖排 | 明确告知准确率有限，输出全部标 `[需核对]` 并带【需人工核对】+行号/裁剪区域证据，不猜内容 |
| 复杂合并表格 | 不自动重建工作簿/合并语义，输出 Markdown 旁标【需人工核对】；需要原结构时用 `--json`/`--jsonl` 走人工核对 |
| 图签自动裁剪不准 | 用 `--crop x,y,w,h` 显式指定；自动裁剪只是候选区，必须人工核对，不当作图签边界 |
