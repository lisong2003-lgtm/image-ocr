#!/usr/bin/env python3
"""本地图像尺寸与图签候选区检测（不联网、不上传）。

用法：
  python3 image_info.py size <图片>
  python3 image_info.py title-block <图片>

输出一行 JSON。title-block 只给候选框，最终仍以 --crop 或人工核对为准。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

try:
    import os as _boot_os, sys as _boot_sys
    _boot_sys.path.insert(0, _boot_os.path.dirname(_boot_os.path.abspath(__file__)))
    import pyboot as _boot_pyboot
    _boot_pyboot.ensure_utf8_io()
except Exception:
    pass


def _pil_size(path: str):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return int(im.width), int(im.height)
    except Exception:
        return None


def _sips_size(path: str):
    if sys.platform != "darwin":
        return None
    try:
        r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
                           capture_output=True, text=True, timeout=15)
        if r.returncode != 0:
            return None
        w = h = None
        for line in r.stdout.splitlines():
            line = line.strip()
            if line.startswith("pixelWidth:"):
                w = int(line.split(":", 1)[1].strip())
            elif line.startswith("pixelHeight:"):
                h = int(line.split(":", 1)[1].strip())
        if w and h:
            return w, h
    except Exception:
        pass
    return None


def _identify_size(path: str):
    for cmd in ("magick", "identify"):
        try:
            r = subprocess.run([cmd, "-format", "%w %h", path + "[0]"],
                               capture_output=True, text=True, timeout=15)
            if r.returncode == 0:
                parts = r.stdout.strip().split()
                if len(parts) >= 2:
                    return int(parts[0]), int(parts[1])
        except Exception:
            pass
    return None


def image_size(path: str):
    return _pil_size(path) or _sips_size(path) or _identify_size(path)


def _region_score(gray, box):
    """候选框内墨迹密度 + 平均墨量，分数越高越像有内容的图签。"""
    try:
        from PIL import ImageOps
        inv = ImageOps.invert(gray)
        crop = inv.crop(box)
        # 缩到小图再统计，避免大图慢
        if max(crop.size) > 500:
            crop.thumbnail((500, 500))
        vals = crop.tobytes()
        if not vals:
            return 0.0
        ink = sum(1 for v in vals if v > 32) / float(len(vals))
        mean = sum(vals) / float(len(vals)) / 255.0
        return ink * 0.75 + mean * 0.25
    except Exception:
        return 0.0


def title_block_crop(path: str):
    size = image_size(path)
    if not size:
        return {"ok": False, "reason": "无法读取图片尺寸", "crop": None}
    width, height = size
    # 本身已经是横向长条图签截图时，整图就是候选区，避免二次裁掉字段。
    if height <= 420 and width / float(max(1, height)) >= 2.5:
        return {
            "ok": True,
            "side": "full",
            "crop": [0, 0, width, height],
            "scores": {"left": 0.0, "right": 0.0},
            "image_size": [width, height],
            "note": "输入已是横向图签截图，使用整图",
        }
    # 图签通常位于底部；这里比较左下/右下两个候选区的墨迹密度。
    box_w = max(1, int(round(width * 0.48)))
    box_h = max(1, int(round(height * 0.30)))
    y0 = max(0, height - box_h)
    left = (0, y0, box_w, height)
    right = (width - box_w, y0, width, height)
    side = "right"
    scores = {"left": 0.0, "right": 0.0}
    try:
        from PIL import Image
        with Image.open(path) as im:
            gray = im.convert("L")
            scores["left"] = round(_region_score(gray, left), 4)
            scores["right"] = round(_region_score(gray, right), 4)
        # 差异不明显时按工程图习惯优先右下
        if scores["left"] > scores["right"] + 0.02:
            side = "left"
    except Exception:
        # 没有 Pillow 时仍给右下候选，识别阶段会回退原图
        pass
    x0 = 0 if side == "left" else width - box_w
    return {
        "ok": True,
        "side": side,
        "crop": [x0, y0, box_w, box_h],
        "scores": scores,
        "image_size": [width, height],
        "note": "候选区，不等于最终图签边界；可用 --crop 覆盖",
    }


def main(argv):
    if len(argv) < 3 or argv[1] not in ("size", "title-block"):
        print("usage: image_info.py size|title-block <image>", file=sys.stderr)
        return 2
    cmd, path = argv[1], argv[2]
    if not os.path.isfile(path):
        print(json.dumps({"ok": False, "reason": "文件不存在", "path": path}, ensure_ascii=False))
        return 1
    if cmd == "size":
        size = image_size(path)
        print(json.dumps({"ok": bool(size), "width": size[0] if size else None,
                          "height": size[1] if size else None}, ensure_ascii=False))
        return 0 if size else 1
    print(json.dumps(title_block_crop(path), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
