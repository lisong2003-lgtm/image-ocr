#!/usr/bin/env bash
# preprocess 跨平台 CLI 入口（macOS / Linux；Windows 用 scripts/preprocess.cmd 或 python scripts/preprocess.py）。
exec python3 "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/preprocess.py" "$@"
