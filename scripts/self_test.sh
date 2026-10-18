#!/bin/bash
# image-ocr v0.3.3 回归 + 边界自检（中文）：3 项回归 + 8 项边界样例，全部通过才算达标
set -euo pipefail
SELF="$0"
if [ -L "$SELF" ]; then SELF="$(readlink "$SELF")"; fi
DIR="$(cd "$(dirname "$SELF")" && pwd)"
OCR="$DIR/ocr_image"
if [ ! -x "$OCR" ] && [ -f "$DIR/ocr_image.sh" ]; then OCR="$DIR/ocr_image.sh"; fi
SKILL="$(cd "$DIR/.." && pwd)"
EX="$SKILL/examples"
fail=0
steps=0

echo "== 回归 1/3 版本 =="
"$OCR" --version | grep -q '0.3.3' || { echo "❌ 版本号错误 (expect 0.3.3)"; fail=1; }
steps=$((steps+1))

echo "== 回归 2/3 自检 =="
"$OCR" --doctor >/dev/null 2>&1 || { echo "❌ --doctor 失败"; fail=1; }
steps=$((steps+1))

echo "== 回归 3/3 帮助包含新参数（v0.3.1+） =="
h="$("$OCR" 2>&1 || true)"
for k in --crop --doctor --version --quiet --workers --progress --clear-cache --resume --fields --crop-preview --table-gap --table-conf; do
  echo "$h" | grep -q -- "$k" || { echo "❌ 缺少 $k"; fail=1; }
done
steps=$((steps+1))

# 边界样例：8 项
declare -a TEXT_EDGE=(example-handwriting example-handwriting-hard example-blur-heavy example-lowres example-stamp-overlap example-vertical-cn)
declare -a TABLE_EDGE=(example-merged-table example-merged-table-complex)

check_text_edge() {
  local name="$1"
  local img="$EX/$name.png" exp="$EX/$name.expected.txt"
  echo "== 边界 $name =="
  [ -f "$img" ] || { echo "❌ 缺少 $img"; fail=1; }
  [ -f "$exp" ] && grep -q "需人工核对" "$exp" || { echo "❌ 缺少 $exp 的需人工核对说明"; fail=1; }
  grep -qi "需人工核对" "$SKILL/SKILL.md" || { echo "❌ SKILL 缺少需人工核对规则"; fail=1; }
  local o e rc
  o="$(mktemp)"; e="$(mktemp)"
  "$OCR" --no-cache --quiet "$img" >"$o" 2>"$e"; rc=$?
  if [ "$rc" != 0 ]; then echo "❌ $name OCR 运行失败 rc=$rc"; fail=1; fi
  if ! grep -qiE "置信度|需人工核对|warn:" "$e" && ! grep -q "需人工核对" "$o"; then echo "❌ $name 未产生低置信/需人工核对信号"; fail=1; fi
  if ! grep -q "需人工核对" "$o" && [ -z "$(cat "$e")" ]; then echo "❌ $name 输出既无需人工核对也无低置信告警"; fail=1; fi
  rm -f "$o" "$e"
  steps=$((steps+1))
}

check_table_edge() {
  local name="$1"
  local img="$EX/$name.png" exp="$EX/$name.expected.txt"
  echo "== 边界 $name =="
  [ -f "$img" ] || { echo "❌ 缺少 $img"; fail=1; }
  [ -f "$exp" ] && grep -q "需人工核对" "$exp" || { echo "❌ 缺少 $exp 的需人工核对说明"; fail=1; }
  grep -qi "复杂合并单元格" "$SKILL/SKILL.md" || { echo "❌ SKILL 缺少复杂合并单元格规则"; fail=1; }
  local o e
  o="$(mktemp)"; e="$(mktemp)"
  "$OCR" --no-cache --table "$img" >"$o" 2>"$e"
  if grep -qiE "已自动重建|自动重建工作簿|已还原合并|已还原.*合并" "$o" "$e"; then echo "❌ $name 不允许声称自动重建合并"; fail=1; fi
  rm -f "$o" "$e"
  steps=$((steps+1))
}

for n in "${TEXT_EDGE[@]}"; do check_text_edge "$n"; done
for n in "${TABLE_EDGE[@]}"; do check_table_edge "$n"; done

if [ "$fail" = "0" ]; then
  echo "✅ 自检完成：回归 3/3 + 边界 $((${#TEXT_EDGE[@]}+${#TABLE_EDGE[@]})) 项全部通过（共 ${steps} 步）"
else
  echo "❌ 自检失败（${steps} 步，fail=${fail}）"
  exit 1
fi
