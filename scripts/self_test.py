#!/usr/bin/env python3
"""document + smoke 级自检（image-ocr）。

覆盖：
- SKILL.md / manifest.json 完整性（document）
- 关键脚本/引用文件存在性（smoke）
- PYTHONIOENCODING=ascii 下 smoke_utf8_json.py 中文 JSON 输出（UTF-8 自举防线）
- 关键 CLI --help 返回码
"""
from __future__ import annotations

try:
    import os as _boot_os, sys as _boot_sys
    _boot_sys.path.insert(0, _boot_os.path.dirname(_boot_os.path.abspath(__file__)))
    import pyboot as _boot_pyboot
    _boot_pyboot.ensure_utf8_io()
except Exception:
    pass

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PYTHON = sys.executable
FAILURES: list[str] = []
CHECK_FILES: list[str] = [
        "SKILL.md",
        "manifest.json",
        "README.md",
        "scripts/pyboot.py",
        "scripts/lint_cross_platform.py",
        "scripts/smoke_utf8_json.py",
        "scripts/preprocess.py",
        "scripts/ocr_image",
        "scripts/ocr_image.cmd",
        "scripts/ocr_image.js",
        "scripts/ocr_image.ps1",
        "scripts/download_langs.sh",
        "scripts/setup.sh",
        "scripts/self_test.py"
]
CLI_HELP: list[str] = [

]


def check(cond: bool, msg: str) -> None:
    if cond:
        print(f"PASS  {msg}")
    else:
        FAILURES.append(msg)
        print(f"FAIL  {msg}")


def run(cmd: list[str], cwd: Path) -> tuple[int, str]:
    import os as _os
    env = dict(_os.environ)
    env["PYTHONIOENCODING"] = "ascii"
    env["PYTHONUTF8"] = "1"
    r = subprocess.run(cmd, cwd=str(cwd), env=env, capture_output=True, text=True)
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main() -> int:
    skill_md = ROOT / "SKILL.md"
    manifest = ROOT / "manifest.json"
    check(skill_md.is_file(), "SKILL.md 存在")
    check(manifest.is_file(), "manifest.json 存在")
    check("name:" in skill_md.read_text(encoding="utf-8")[:400], "SKILL.md frontmatter name")
    if manifest.is_file():
        m = json.loads(manifest.read_text(encoding="utf-8"))
        check(m.get("entry") == "SKILL.md", "manifest entry=SKILL.md")
        check(("scripts" in m) and ("references" in m), "manifest 含 scripts/references")

    for rel in CHECK_FILES:
        check((ROOT / rel).is_file(), f"文件存在 {rel}")

    rc, out = run([PYTHON, str(HERE / "smoke_utf8_json.py")], HERE)
    ok = rc == 0 and '"status": "ok"' in out
    check(ok, "smoke_utf8_json (PYTHONIOENCODING=ascii) JSON ok")
    if not ok:
        print(out)

    for cli in CLI_HELP:
        rc, out = run([PYTHON, str(HERE / cli), "--help"], HERE)
        check(rc == 0, f"CLI --help rc=0  {cli}")
        if rc != 0:
            print(out)

    if FAILURES:
        print("SELF_TEST_FAILED", FAILURES)
        return 1
    print("SELF_TEST_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
