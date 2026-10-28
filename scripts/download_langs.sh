#!/bin/bash
# image-ocr 多语言模型下载（tessdata_fast）
# v0.3.6：消除双实现——统一转发到 Node 版 --download-langs（纯 Node 下载，不依赖 curl），
#         语言包默认落 ~/.cache/image-ocr/tessdata（可用 TESSDATA_DIR 覆盖，不污染技能目录）。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="${CODEX_NODE:-}"
if [ -z "$NODE_BIN" ]; then
  for c in "$HOME"/.cache/codex-runtimes/*/dependencies/node/bin/node /usr/local/bin/node /opt/homebrew/bin/node; do
    if [ -x "$c" ]; then NODE_BIN="$c"; break; fi
  done
fi
if [ -z "$NODE_BIN" ]; then NODE_BIN="$(command -v node || true)"; fi
[ -n "$NODE_BIN" ] || { echo "❌ 未找到 node，无法下载语言包" >&2; exit 1; }
exec "$NODE_BIN" "$DIR/ocr_image.js" --download-langs "$@"
