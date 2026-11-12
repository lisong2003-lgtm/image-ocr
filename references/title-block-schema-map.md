# 图签 JSONL → cad-file-reader 图签 schema 映射

本文件只定义字段映射，不生成最终图签结论。OCR 结果一律是候选，必须人工核对。
对齐对象：`cad-file-reader/scripts/cad_pdf_ocr.py` 的
`TITLE_BLOCK_KEYS` / `extract_title_block_layout()` 与 `docs/pdf-pipeline.md`
中 `pdf_meta.title_block`、`page_bbox`、`source_bbox_px` 的口径。

## 1. 行级 JSONL 字段

`image-ocr --jsonl` 每行一个对象，字段如下（坐标为预处理后/裁剪后图像像素空间）：

| image-ocr JSONL | 类型 | 含义 | cad-file-reader 对应 |
|---|---|---|---|
| `source` | string | 源文件或 `文件 [第N页]` | `source_path` / 证据来源 |
| `page` | number | 页码，从 1 开始 | `page_index` / `page` |
| `block_id` | number | Tesseract 块序号（页内） | 证据分组，不直接入 schema |
| `line_id` | number | 块内行序号（页内） | 证据行号，不直接入 schema |
| `reading_order` | number | 页内阅读顺序，严格单调递增 | `reading_order`（下游可保留） |
| `text` | string | 该行 OCR 文本 | `title_block.<key>.text`（命中关键词后） |
| `conf` | number | 0–100 行置信度 | `title_block.<key>.confidence`（需换算为 0–1，见下） |
| `uncertain` | boolean | `conf < 阈值` | `review_required=true` 的证据之一 |
| `box` | object | `{x0,y0,x1,y1}` 像素框 | `source_bbox_px`；按 dpi 换算后为 `page_bbox` |
| `dpi` | number | 识别所用 DPI（图签预设 300） | `page_bbox` 换算参数 |
| `preprocess` | string[] | 预处理与二次识别记录 | `review_evidence.preprocess`（自定义扩展） |
| `source_crop` | string/null | 显式裁剪或 `auto:side:x,y,w,h` | `review_evidence.source_crop`（自定义扩展） |
| `needs_review_reason` | string/null | 见下方枚举 | `review_reasons` 的元素 |

`needs_review_reason` 枚举：
`low_conf`（行置信度低于阈值）、`blur`（整体质量差且行置信度偏低）、
`rotated`（识别用了旋转结果）、`crop_partial`（行框贴裁剪边缘，可能被截断）、
`table_complex`（表格模式且低置信）、`handwriting`（预留；本工具不承诺手写体识别）。

## 2. 图签字段名映射

cad-file-reader 的 `title_block` 键（以 `cad_pdf_ocr.py` 为准）：

| 中文标签（正则） | cad-file-reader key | image-ocr 行文本示例 |
|---|---|---|
| 项目 / 项目名称 / 工程 / 工程名称 | `project` | `工程名称：合成示例项目` |
| 图名 | `drawing_name` | `图名：A 紧凑经济型施工平面布置图` |
| 图号 | `drawing_no` | `图号 SLP-A-F` |
| 图别 / 专业 | `discipline` | `专业：总图` |
| 比例 / SCALE | `scale` | `比例 1:500` |
| 日期 | `date` | `日期 2026-11-10` |
| 设计 / DESIGN | `designer` | `设计：张工` |
| 审核 / APPROVED | `reviewer` | `审核：李工` |
| 制图 / 绘图 | `draftsperson` | `制图：王工` |
| 校对 | `proofreader` | `校对：赵工` |
| 备注 | `remark` | `备注：草案` |
| REV | `revision` | `REV 0` |

标签后没有值时，cad-file-reader 会写 `<key>_label`（例如 `drawing_name_label`）；
image-ocr 的 JSONL 不主动推断，保留原行 `text`，由下游按同一规则配对。

## 3. 置信度与坐标换算

- `image-ocr.conf` 是 0–100；cad-file-reader 的 `confidence` 通常是 0–1：
  `confidence = round(conf / 100, 3)`。
- 像素框换算为 PDF 点（1 in = 72 pt），与 cad-file-reader `_px_to_pdf_bbox()` 一致，只缩放、不翻转 y：
  `page_bbox = [x0 * 72 / dpi, y0 * 72 / dpi, x1 * 72 / dpi, y1 * 72 / dpi]`。
  因此这里的 `page_bbox` 继承图像坐标的左上原点；下游不要按 PDF 左下原点再翻一次。
- `box` 是识别图（可能已裁剪/缩放）的像素坐标；原始图坐标需结合
  `source_crop` 与 `preprocess` 反算，不能直接当原始页坐标。
- cad-file-reader 当前 `extract_title_block_layout()` 的区域口径是：文字框中心
  `cx > 0.45 * max_x` 且 `cy < 0.55 * max_y`（`max_y` 取该页全部文字框最大 y，不是页高）；
  代码注释称“右下”，实际 y 轴按图像自上而下。对接时以该函数源码为准，不要按注释推断。
- `--preset title-block` 独立按底部左下/右下墨迹密度给候选区，差小于 0.02 时默认右下；
  两套区域规则只做候选，不互相替代。

## 4. 最小对照示例

```json
{"source":"图纸.png","page":1,"block_id":1,"line_id":2,"reading_order":2,"text":"图号 SLP-A-F","conf":83,"uncertain":false,"box":{"x0":57,"y0":212,"x1":501,"y1":236},"dpi":300,"preprocess":["grayscale","autocontrast","crop","binarize"],"source_crop":"auto:left:0,1120,1152,480","needs_review_reason":null}
```

可映射为：

```json
{
  "title_block": {
    "drawing_no": {
      "text": "SLP-A-F",
      "confidence": 0.83,
      "page_index": 1,
      "source_bbox_px": [57, 212, 501, 236],
      "page_bbox": [13.68, 50.88, 120.24, 56.64]
    }
  },
  "review_required": false,
  "review_reasons": []
}
```

注意：上面的 `page_bbox` 只是换算示例；如果 `box` 来自裁剪图，必须先加回
`source_crop` 的偏移再换算，不能把裁剪图坐标当整页坐标。
