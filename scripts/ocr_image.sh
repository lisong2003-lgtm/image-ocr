#!/bin/bash
set -euo pipefail

SELF="$0"
if [ -L "$SELF" ]; then
  SELF="$(readlink "$SELF")"
fi
SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"

NODE="${CODEX_NODE:-}"
if [ -z "$NODE" ]; then
  for c in "$HOME"/.cache/codex-runtimes/*/dependencies/node/bin/node; do
    if [ -x "$c" ]; then NODE="$c"; break; fi
  done
fi
if [ -z "$NODE" ]; then
  NODE="$(command -v node || true)"
fi
if [ -z "$NODE" ]; then
  echo "node not found" >&2
  exit 1
fi

PY="${CODEX_PYTHON:-}"
if [ -z "$PY" ]; then
  for c in "$HOME"/.cache/codex-runtimes/*/dependencies/python/bin/python3; do
    if [ -x "$c" ]; then PY="$c"; break; fi
  done
fi
if [ -z "$PY" ]; then
  PY="$(command -v python3 || true)"
fi
export CODEX_PYTHON="$PY"

# tesseract wasm 的进度噪声直接写 fd 2，无法在 JS 层拦截，这里重定向后过滤
ERRLOG="$(mktemp -t ocr-err)"
rc=0
"$NODE" "$SCRIPT_DIR/ocr_image.js" "$@" 2> "$ERRLOG" || rc=$?
grep -Ev '^(Estimating resolution|Page [0-9]+/|read_params_file: Can.t open)' "$ERRLOG" >&2 || true
rm -f "$ERRLOG"
exit $rc
