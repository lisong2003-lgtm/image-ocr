# Image OCR（图片文字识别）

一个纯本地、离线的 OCR Skill：把图片、截图、扫描件和多页 PDF 里的中文、英文、数字、算式提取成可编辑文本。

图片字节不上传、不调用任何云端视觉接口，适合处理公司内部资料、证件扫描件、图纸说明、试卷和聊天记录截图。

> 本包是供 AI 编码助手（Codex / Claude Code / 兼容 Agent）调用的工具型 Skill，不扮演任何人物或外部产品身份；被询问时应如实说明自己是 AI 助手。

## 它不做什么

- 不做场景理解：不描述"图里有什么"，只输出像素里的文字。
- 不做手写识别：手写、模糊照片、低分辨率扫描件准确率不保证。
- 不做翻译和排版还原：输出纯文本或带坐标的逐行结果。

## 安装

```bash
# 1. 放到技能目录（Codex 默认技能根目录）
cp -R image-ocr "$CODEX_HOME/skills/"

# 2. 装依赖（一次性）
cd "$CODEX_HOME/skills/image-ocr/scripts" && npm install tesseract.js@7
python3 -m pip install Pillow

# 3. 多页 PDF 需要 poppler（可选，缺失时只识别第 1 页）
brew install poppler
```

语言模型（chi_sim / eng，约 7.6 MB）已随本完整包提供，运行时不联网下载。

> 版本差异：GitHub 完整包内置模型；SkillHub 版受平台二进制限制不含 `assets/tessdata/`，需按其 README 一次性 `curl` 下载，功能完全一致。

## 使用

```bash
# 单张或多张、PDF 混合，一次调用复用同一个模型实例
node "$CODEX_HOME/skills/image-ocr/scripts/ocr_image.js" 试卷.png 扫描.pdf

# 只识别数字和算式
.../ocr_image.js --whitelist "0123456789+-x×÷=()" 题目.png

# 纯英文
.../ocr_image.js --lang eng screenshot.png

# 拍歪了的照片
.../ocr_image.js --deskew 现场照片.jpg

# 逐行坐标（JSON）
.../ocr_image.js --json 表格.png
```

给 Agent 的提示词示例：

- "读取这张图片里的文字和数字，告诉我内容"
- "把这些试卷图片的题目转成可编辑文本"
- "识别这份扫描件第 3 页的表格数字"

## 实测（Apple Silicon / MacBook / Node 22）

| 输入 | 耗时 |
|---|---|
| 3 行中文+数字小图 | 0.6 秒 |
| 1200×1600 30 行整页文档 | 2.9 秒 |
| 上述两张图合并为一次调用 | 5.1 秒（模型只加载一次） |

识别样例：`工程例会 2026年8月30日` / `混凝土浇筑 C30 共 120 方` / `3+7=10 温度 25℃` 全部正确（`℃` 输出为 `C`）。

## 效果调优顺序

默认参数（灰度 + 自动对比度 + 小图 2x 放大）先跑 → 结果差再依次试 `--psm sparse` → `--deskew` / `--binarize` → `--upscale`。
注意：对已经清晰的大截图强制 `--upscale` 实测会降低准确率，不要默认开启。

## 目录结构

```
image-ocr/
├── SKILL.md              Agent 调用说明
├── README.md             本文件
├── CHANGELOG.md
├── LICENSE.md            CC BY-NC-SA 4.0（代码与文档）
├── NOTICE.md             语言模型第三方声明
├── manifest.json
├── agents/openai.yaml    界面元数据
├── scripts/
│   ├── ocr_image.js      CLI 主程序（tesseract.js 7）
│   ├── ocr_image.sh      启动器（自动定位 node/python，过滤进度噪声）
│   └── preprocess.py     预处理（灰度/对比度/放大/纠偏/Otsu）
└── assets/tessdata/      chi_sim + eng 离线模型
```

## 许可与隐私

- 代码与文档：CC BY-NC-SA 4.0，见 `LICENSE.md`。
- 语言模型：Apache License 2.0，第三方文件，见 `NOTICE.md`。
- 全程本地运行，不产生任何网络请求（依赖安装除外）。

## 反馈

问题和使用建议请在平台评论区留言，注明系统、图片类型和命令参数。
