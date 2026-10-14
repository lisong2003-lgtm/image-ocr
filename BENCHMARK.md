# image-ocr 效果基准（真实实测）

环境：macOS（Apple Silicon，Codex 运行时 node v24 / tesseract.js 7 本地 wasm）
命令统一：`scripts/ocr_image --lang eng --no-cache <样张>`（低对比样张含自动增强）

| 样张 | 预期关键字段 | 实测输出 | 关键字段命中 | 低置信行 | 耗时 |
|---|---|---|---|---|---|
| sample-clear.png（清晰截图 1000×300） | `2026-1014`、`128.50`、`C30`、`12.5 m3` | 与预期逐字一致 | 4/4 | 0 | 1.03s |
| sample-lowcontrast.png（低对比 900×220） | `LOW CONTRAST 2026` | 与预期一致 | 1/1 | 0 | 1.20s |
| sample-skewed.png（-3.5° 歪斜照片） | 同 clear | 与预期一致 | 4/4 | 0 | 1.38s |

说明：
- 样张均为本脚本生成，不含任何公司或个人信息。
- "关键字段命中"=预期文本中的关键字段在实际输出中逐字出现。
- 已知边界（不承诺）：手写体、严重模糊、复杂合并单元格表格、完整 LaTeX 公式版面。
