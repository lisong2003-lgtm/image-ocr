#!/bin/bash
# image-ocr 依赖体检/一键修复（全程中文提示）
set -euo pipefail
SELF="$0"
if [ -L "$SELF" ]; then SELF="$(readlink "$SELF")"; fi
DIR="$(cd "$(dirname "$SELF")" && pwd)"
SKILL="$(cd "$DIR/.." && pwd)"
REPAIR=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--repair" ]; then REPAIR=1; else ARGS+=("$a"); fi
done

NODE=""
for c in "$HOME"/.cache/codex-runtimes/*/dependencies/node/bin/node; do
  if [ -x "$c" ]; then NODE="$c"; break; fi
done
if [ -z "$NODE" ]; then NODE="$(command -v node || true)"; fi

PY=""
for c in "$HOME"/.cache/codex-runtimes/*/dependencies/python/bin/python3; do
  if [ -x "$c" ]; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then PY="$(command -v python3 || true)"; fi

echo "==== image-ocr 环境体检 ===="
ok=1
if [ -n "$NODE" ]; then echo "✅ node: $NODE"; else echo "❌ node：未找到（需要 Node.js 18+ 或 Codex 运行时）"; ok=0; fi

if [ -n "$PY" ]; then echo "✅ python3: $PY"; else echo "❌ python3：未找到（需 Python 3.8+）"; ok=0; fi

TESS=""
if [ -n "$NODE" ]; then
  for c in "$DIR/node_modules/tesseract.js" "$HOME"/.cache/codex-runtimes/*/dependencies/node/node_modules/tesseract.js; do
    if [ -f "$c/package.json" ]; then TESS="$c"; break; fi
  done
fi
if [ -n "$TESS" ]; then echo "✅ tesseract.js: $TESS"; else echo "❌ tesseract.js：未找到（运行 $0 --repair 尝试安装，或确认 Codex 运行时缓存完整）"; ok=0; fi

PILLOW=0
if [ -n "$PY" ]; then
  if "$PY" -c "import PIL" >/dev/null 2>&1; then PILLOW=1; fi
fi
if [ "$PILLOW" = "1" ]; then echo "✅ Pillow: 已安装"; else echo "❌ Pillow：未安装（运行 $0 --repair）"; ok=0; fi

MODELS=$(ls "$SKILL"/assets/tessdata/*.traineddata 2>/dev/null | sed 's/.*\///; s/\.traineddata//' | tr '\n' ',' | sed 's/,$//')
if [ -n "$MODELS" ]; then echo "✅ 语言模型: ${MODELS}"; else echo "⚠️ 语言模型：无（运行 $DIR/download_langs.sh chi_sim,eng 安装）"; fi

if command -v pdftoppm >/dev/null 2>&1; then echo "✅ pdftoppm: 可用（多页 PDF）"; else echo "⚠️ pdftoppm：未安装（多页 PDF 只识别第 1 页；macOS: brew install poppler）"; fi

if [ "$REPAIR" = "1" ]; then
  echo "---- 补救 ----"
  if [ -n "$NODE" ] && [ -z "$TESS" ]; then
    echo "安装 tesseract.js（本地目录）..."
    ( cd "$DIR" && npm --no-fund --no-audit install tesseract.js@7 2>/dev/null || echo "❌ npm 安装失败，请先安装 npm/node，或恢复 Codex 运行时缓存" )
  fi
  if [ -n "$PY" ] && [ "$PILLOW" = "0" ]; then
    "$PY" -m pip install --quiet Pillow 2>/dev/null && echo "✅ Pillow 已安装" || echo "❌ Pillow 安装失败，请检查网络和 python 环境（提示：$PY -m pip install Pillow）"
  fi
  if [ -z "$MODELS" ]; then
    bash "$DIR/download_langs.sh" chi_sim,eng || echo "⚠️ 语言包下载失败，请检查网络或手动下载"
  fi
fi

if [ "$ok" = "1" ]; then echo "体检通过：可运行 ocr_image --doctor 做一次微型自检识别"; else echo "体检发现缺项，请按上面提示处理（或运行 $0 --repair）"; exit 1; fi
