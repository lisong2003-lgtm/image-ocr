# image-ocr

本地离线 OCR 技能（v0.3.3）。把图片/扫描件/多页 PDF 中的文字、数字、表格、代码、算式提取为文本，全程在本机运行，不上传图片字节。

## 依赖与环境
- 需要 Node.js 18+（或 Codex 运行时缓存）与 Python 3.8+（预处理用 Pillow）。
- macOS/Linux：`bash <skill>/scripts/setup.sh --repair`；Windows：`powershell -File <skill>\scripts\setup.ps1 -Repair`。
- 多页 PDF 需要 poppler `pdftoppm`（macOS：`brew install poppler`）。
- 语言模型：默认中文 chi_sim + 英文 eng。缺包时 `scripts/ocr_image --download-langs chi_sim,eng,...`。

## 用法
```bash
scripts/ocr_image 图片.png                          # 默认 chi_sim，自动增强
scripts/ocr_image --lang eng 截图.png               # 纯英文/数字
scripts/ocr_image --table 表.png                    # Markdown 表格（草稿级）
scripts/ocr_image --csv --out 表.csv 表.png         # UTF-8 BOM CSV
scripts/ocr_image --code 报错.png                   # 代码截图
scripts/ocr_image --crop x,y,w,h 图.png             # 只识别区域
scripts/ocr_image --json 图.png                     # 带坐标与每行置信度
scripts/ocr_image --fields date,amount,id 图.png    # 结构化字段（不补全）
scripts/ocr_image 多页.pdf --page 3 --dpi 400       # PDF 指定页
scripts/ocr_image a.png b.png --workers 3           # 并行批量（仅文本）
```

常用参数：`--deskew --binarize --auto-rotate --auto-retry --quiet --out 文件 --progress --resume`。完整参数见 `scripts/ocr_image --help`。

## 自检
```bash
bash scripts/self_test.sh
```
3 项回归 + 8 项边界样例（手写体、更难手写体、严重模糊、低分辨率、印章压字、竖排/异体字、复杂合并表格 ×2），全部 PASS 才写通过记录。通过后可归档：
```bash
bash scripts/self_test.sh > /tmp/image_ocr_selftest_0.3.3.log
```

## 边界与降级（不承诺准确）
- 手写体、严重模糊、低分辨率、印章压字、竖排/异体字：准确率有限，低置信时输出【需人工核对】+ 行号/conf/裁剪区域证据，不自动补全。
- 复杂合并表格：工具只按行/列间距扁平行切分，不能自动复原合并语义；需要原结构用 `--json` + 人工核对。
- 完整 LaTeX 公式版面不在支持范围。
- 降级路径：截图裁剪 → 重试（`--binarize/--deskew/--auto-rotate`）→ 提高 DPI → 表格专项 → 人工核对。

## 隐私与合规
- 全程本地；不把图片字节发往云端。需下载语言包/依赖时才联网。
- 示例图片全部为脚本自造，不含任何公司、客户或个人身份信息。

## 双包说明（发布）
- **GitHub 完整包**（`image-ocr-full-0.3.3.zip`）：含本机全部文件与 `assets/tessdata/*.traineddata` 二进制模型，功能与本地一致。
- **SkillHub 轻量包**（`image-ocr-skillhub-0.3.3.zip`）：平台不收二进制/无扩展名脚本，故不含 `.traineddata`；下载后先执行：
  ```bash
  bash scripts/download_langs.sh chi_sim,eng
  ```
  其余功能与完整包一致。平台专用调整只进发布包，不回写本机原版。

## 许可证
第三方组件（tesseract.js、tessdata 语言包、poppler 等）各自遵守其开源许可；完整来源与哈希见 `NOTICE.md`。
