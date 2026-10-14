#!/bin/bash
# image-ocr v0.3.0 回归测试（中文）
set -euo pipefail
SELF="$0"; if [ -L "$SELF" ]; then SELF="$(readlink "$SELF")"; fi
DIR="$(cd "$(dirname "$SELF")" && pwd)"
OCR="$DIR/ocr_image"
if [ ! -x "$OCR" ] && [ -f "$DIR/ocr_image.sh" ]; then OCR="$DIR/ocr_image.sh"; fi
fail=0
echo "== 1/3 版本 =="
"$OCR" --version | grep -q '0.3' || { echo "❌ 版本号错误"; fail=1; }
echo "== 2/3 自检 =="
"$OCR" --doctor >/dev/null 2>&1 || { echo "❌ --doctor 失败"; fail=1; }
echo "== 3/3 帮助包含新参数（v0.3.1） =="
h="$("$OCR" 2>&1 || true)"
for k in --crop --doctor --version --quiet --workers --progress --clear-cache --resume --fields --crop-preview --table-gap --table-conf; do
  echo "$h" | grep -q -- "$k" || { echo "❌ 缺少 $k"; fail=1; }
done
if [ "$fail" = "0" ]; then echo "✅ 三项回归通过"; else echo "❌ 回归失败"; exit 1; fi
