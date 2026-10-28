#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""generate_examples.py — 生成 8 张 OCR 边界样例图（纯标准库，不依赖 PIL）。

用 zlib+struct 手写 PNG：纯色底 + 简单几何/高对比文字块位图。
OCR 断言为宽松匹配（非空 + 关键词命中），见 self_test.sh。
生成的图是"结构性边界"（对比度/噪声/旋转/空白/表格线），不追求字形真实。
"""
import struct
import sys
import zlib
from pathlib import Path

W, H = 240, 120

FONT3x5 = {  # 3x5 像素字体（仅覆盖样例需要的字符）
    "A": ["010", "101", "111", "101", "101"],
    "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"],
    "G": ["011", "100", "101", "101", "011"],
    "I": ["111", "010", "010", "010", "111"],
    "K": ["101", "101", "110", "101", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"],
    "X": ["101", "101", "010", "101", "101"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"],
    "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "110", "001", "110"],
    " ": ["000", "000", "000", "000", "000"],
}


def draw_text(px, text, x0, y0, scale=2, color=(0, 0, 0)):
    x = x0
    for ch in text.upper():
        glyph = FONT3x5.get(ch, FONT3x5[" "])
        for ry, row in enumerate(glyph):
            for rx, bit in enumerate(row):
                if bit == "1":
                    for dy in range(scale):
                        for dx in range(scale):
                            px[y0 + ry * scale + dy][x + rx * scale + dx] = color
        x += 4 * scale


def make_png(path, px):
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)
    Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    )


def canvas(bg=(255, 255, 255)):
    return [[list(bg) for _ in range(W)] for _ in range(H)]


def fill_rect(px, x0, y0, x1, y1, color):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            px[y][x] = list(color)


SAMPLES = [
    # (文件名, 是否预期可识别, 绘制函数)
    ("01-solid-white", True, lambda px: draw_text(px, "PURE WHITE", 40, 48, 2)),
    ("02-high-contrast", True, lambda px: (fill_rect(px, 0, 0, W, H, (0, 0, 0)), draw_text(px, "BLACK BG", 40, 48, 2, (255, 255, 255)))),
    ("03-low-contrast", False, lambda px: (fill_rect(px, 0, 0, W, H, (235, 235, 235)), draw_text(px, "FAINT", 60, 48, 2, (215, 215, 215)))),
    ("04-noise", True, lambda px: _noise(px)),
    ("05-small-text", True, lambda px: draw_text(px, "TINY 123", 60, 52, 1)),
    ("06-table-lines", True, lambda px: _table(px)),
    ("07-rotated", False, lambda px: _rotated(px)),
    ("08-blank", False, lambda px: None),
]


def _noise(px):
    import random
    random.seed(42)
    draw_text(px, "NOISY OK", 40, 48, 2)
    for _ in range(1500):
        x, y = random.randrange(W), random.randrange(H)
        v = random.randrange(256)
        px[y][x] = [v, v, v]


def _table(px):
    for gx in range(3):
        fill_rect(px, 40 + gx * 60, 20, 42 + gx * 60, 100, (120, 120, 120))
    fill_rect(px, 40, 58, 200, 60, (120, 120, 120))
    draw_text(px, "A1", 60, 36, 1)
    draw_text(px, "B2", 120, 72, 1)


def _rotated(px):
    import math
    src = canvas()
    draw_text(src, "TILT", 70, 48, 2)
    cx, cy, ang = W // 2, H // 2, math.radians(12)
    ca, sa = math.cos(ang), math.sin(ang)
    for y in range(H):
        for x in range(W):
            sx = int((x - cx) * ca + (y - cy) * sa + cx)
            sy = int(-(x - cx) * sa + (y - cy) * ca + cy)
            if 0 <= sx < W and 0 <= sy < H:
                px[y][x] = src[sy][sx]


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "examples"
    out.mkdir(parents=True, exist_ok=True)
    for name, _expect, fn in SAMPLES:
        px = canvas()
        fn(px)
        make_png(out / (name + ".png"), px)
        print("OK", out / (name + ".png"))
    print("EXAMPLES_OK 8 张样例已生成")


if __name__ == "__main__":
    main()
