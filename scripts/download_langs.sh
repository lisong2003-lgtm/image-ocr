#!/bin/bash
# image-ocr 多语言模型下载（tessdata_fast）
set -euo pipefail
LANGS="$1"
DIR="$(cd "$(dirname "$0")/../assets/tessdata" && pwd)"
mkdir -p "$DIR"
BASEURL="https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main"
IFS=',' read -r -a arr <<< "$LANGS"
for L in "${arr[@]}"; do
  L="$(echo "$L" | xargs)"
  [ -z "$L" ] && continue
  OUT="$DIR/${L}.traineddata"
  if [ -s "$OUT" ]; then
    echo "已存在: ${L}.traineddata ($(wc -c < "$OUT") bytes)，跳过" >&2
    continue
  fi
  echo "下载 ${L} ..." >&2
  if ! curl -fsSL --max-time 60 --http1.1 "$BASEURL/${L}.traineddata" -o "$OUT"; then
    rm -f "$OUT"
    echo "❌[下载] ${L} 失败，已删除残留文件" >&2
    exit 1
  fi
  size=$(wc -c < "$OUT")
  if [ "$size" -lt 50000 ]; then
    rm -f "$OUT"
    echo "❌[下载] ${L} 文件异常（仅 ${size} bytes），已删除" >&2
    exit 1
  fi
  echo "已安装: ${OUT} (${size} bytes)" >&2
done
echo "DONE" >&2
