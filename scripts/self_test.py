#!/usr/bin/env python3
"""document + smoke 级自检（image-ocr）。

覆盖：
- SKILL.md / manifest.json 完整性（document）
- 关键脚本/引用文件存在性（smoke）
- PYTHONIOENCODING=ascii 下 smoke_utf8_json.py 中文 JSON 输出（UTF-8 自举防线）
- 关键 CLI --help 返回码
- v0.4.0：preset 解析/冲突提示、JSONL 字段与排序、低置信二次识别标记、旧 --json 兼容
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
        "scripts/ocr_image.sh",
        "scripts/ocr_image.cmd",
        "scripts/ocr_image.js",
        "scripts/image_info.py",
        "scripts/ocr_image.ps1",
        "scripts/download_langs.sh",
        "scripts/setup.sh",
        "scripts/self_test.py",
        "references/title-block-schema-map.md",
        "references/troubleshooting.md",
        "references/feature-log.md"
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


def run_shell(args: list[str], timeout: int = 180) -> tuple[int, str, str]:
    """运行 ocr_image.sh，返回 (rc, stdout, stderr)。"""
    import os as _os
    env = dict(_os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"
    r = subprocess.run(["bash", str(HERE / "ocr_image.sh"), *args], cwd=str(HERE),
                       env=env, capture_output=True, text=True, timeout=timeout)
    return r.returncode, r.stdout or "", r.stderr or ""


def parse_jsonl(out: str) -> list[dict]:
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def check_v04_cli() -> None:
    help_out = ""
    try:
        rc, help_out, help_err = run_shell(["--help"])
        help_out = help_out + help_err
    except Exception as exc:  # noqa: BLE001
        check(False, f"ocr_image.sh --help 可运行（{exc}）")
        return
    check(rc == 0, "ocr_image.sh --help rc=0")
    for key in ("--preset", "--jsonl", "--low-conf-threshold", "--max-line-retries", "--no-line-retry"):
        check(key in help_out, f"帮助包含 {key}")

    # 1) preset 解析
    rc, out, err = run_shell(["--_print-options", "--preset", "title-block"])
    ok = rc == 0
    parsed = None
    if ok:
        try:
            parsed = json.loads(out.strip())
        except Exception:  # noqa: BLE001
            try:
                seg = out[out.index("{"):out.rindex("}") + 1]
                parsed = json.loads(seg)
            except Exception:  # noqa: BLE001
                ok = False
    check(ok, "preset title-block --_print-options 输出 JSON")
    if parsed:
        check(parsed.get("psm") == "block", "preset title-block psm=block")
        check(parsed.get("binarize") is True, "preset title-block binarize=true")
        check(parsed.get("dpi") == 300, "preset title-block dpi=300")
        check(parsed.get("autoTitleCrop") is True, "preset title-block autoTitleCrop=true")

    # 2) 显式参数优先
    rc, out, err = run_shell(["--_print-options", "--preset", "title-block", "--psm", "auto"])
    check(rc == 0 and "被显式参数覆盖" in (out + err), "preset 冲突提示：显式 --psm 覆盖")

    img1 = ROOT / "examples" / "02-high-contrast.png"
    img2 = ROOT / "examples" / "05-small-text.png"
    if not img1.is_file():
        check(False, "examples/02-high-contrast.png 存在（JSONL 用例）")
        return

    # 3) 单文件 JSONL 字段完整性
    rc, out, err = run_shell(["--jsonl", "--no-cache", "--quiet", "--no-line-retry", str(img1)])
    check(rc == 0, "JSONL 单文件 rc=0")
    rows1 = []
    if rc == 0:
        try:
            rows1 = parse_jsonl(out)
        except Exception as exc:  # noqa: BLE001
            check(False, f"JSONL 可逐行解析（{exc}）")
    check(bool(rows1), "JSONL 单文件至少 1 行")
    required = {"source", "page", "block_id", "line_id", "reading_order", "text", "conf",
                "uncertain", "box", "dpi", "preprocess", "source_crop", "needs_review_reason"}
    if rows1:
        missing = sorted(required - set(rows1[0].keys()))
        check(not missing, f"JSONL 字段齐全（缺 {missing}）" if missing else "JSONL 字段齐全")
        ok_conf = all(isinstance(r.get("conf"), (int, float)) and 0 <= r["conf"] <= 100 for r in rows1)
        check(ok_conf, "JSONL conf 均在 0-100")
        ok_box = all(set(("x0", "y0", "x1", "y1")) <= set((r.get("box") or {}).keys()) for r in rows1)
        check(ok_box, "JSONL box 含 x0/y0/x1/y1")
        check(all(isinstance(r.get("preprocess"), list) for r in rows1), "JSONL preprocess 为数组")
        orders = [r["reading_order"] for r in rows1]
        check(orders == list(range(1, len(rows1) + 1)), "JSONL reading_order 从 1 单调递增")

    # 4) 多文件 JSONL
    if img2.is_file():
        rc, out, err = run_shell(["--jsonl", "--no-cache", "--quiet", "--no-line-retry", str(img1), str(img2)])
        rows2 = []
        if rc == 0:
            try:
                rows2 = parse_jsonl(out)
            except Exception as exc:  # noqa: BLE001
                check(False, f"多文件 JSONL 可逐行解析（{exc}）")
        check(rc == 0 and len(rows2) >= 2, "JSONL 多文件输出 >=2 行")
        sources = {str(r.get("source")) for r in rows2}
        check(len(sources) >= 2, "JSONL 多文件包含两个 source")
        by_page: dict[tuple[str, int], list[int]] = {}
        for r in rows2:
            by_page.setdefault((str(r.get("source")), int(r.get("page") or 1)), []).append(r["reading_order"])
        monotonic = all(v == list(range(1, len(v) + 1)) for v in by_page.values())
        check(monotonic, "JSONL 按 (source,page) reading_order 连续递增")

    # 5) 低置信二次识别标记（只有置信度提高才写 retry 标记）
    retry_img = img2 if img2.is_file() else img1
    rc, out, err = run_shell(["--jsonl", "--no-cache", "--quiet", "--low-conf-threshold", "101",
                              "--max-line-retries", "6", str(retry_img)])
    retry_rows = []
    if rc == 0:
        try:
            retry_rows = parse_jsonl(out)
        except Exception:  # noqa: BLE001
            pass
    tagged = [r for r in retry_rows if "retry:upscale2" in (r.get("preprocess") or [])]
    check(rc == 0 and bool(tagged), "低置信重试命中并写 retry:upscale2/psm7")
    check(all("psm7" in (r.get("preprocess") or []) for r in tagged), "重试行同时带 psm7 标记")

    # 6) 裁剪边缘检测：右侧被裁断的行应标 crop_partial（不只查 x1<=2）
    rc, out, err = run_shell(["--jsonl", "--no-cache", "--quiet", "--no-line-retry",
                              "--crop", "0,0,100,100", str(img1)])
    crop_rows = []
    if rc == 0:
        try:
            crop_rows = parse_jsonl(out)
        except Exception:  # noqa: BLE001
            pass
    check(any(r.get("needs_review_reason") == "crop_partial" for r in crop_rows),
          "裁剪右边缘被截断的行标记 crop_partial")

    # 7) 旧 --json 兼容
    rc, out, err = run_shell(["--json", "--no-cache", "--quiet", "--no-line-retry", str(img1)])
    ok = rc == 0
    data = None
    if ok:
        try:
            data = json.loads(out)
        except Exception:  # noqa: BLE001
            ok = False
    check(ok and isinstance(data, list) and bool(data), "--json 仍输出非空数组")
    if isinstance(data, list) and data:
        old_keys = {"page", "text", "conf", "uncertain", "box", "x0", "y0", "x1", "y1"}
        missing = sorted(old_keys - set(data[0].keys()))
        check(not missing, f"--json 旧字段保留（缺 {missing}）" if missing else "--json 旧字段保留")


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
        exists = (ROOT / rel).is_file()
        if not exists and sys.platform != "win32" and rel.lower().endswith((".cmd", ".ps1", ".bat")):
            print(f"SKIP  Windows 专用文件（{sys.platform} 轻量包不随附）{rel}")
            continue
        check(exists, f"文件存在 {rel}")

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

    if sys.platform != "win32":
        check_v04_cli()
    else:
        print("SKIP  v0.4.0 CLI 回归（Windows 由 self_test.sh 的 ps1 等价用例覆盖）")

    if FAILURES:
        print("SELF_TEST_FAILED", FAILURES)
        return 1
    print("SELF_TEST_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
