"""OCR 预处理: 灰度+autocontrast; 小图(<=800px)自动2x放大; --deskew(+-5deg) --binarize(Otsu) --upscale(强制放大) --rotate(90/180/270) --crop x,y,w,h"""

try:
    import os as _boot_os, sys as _boot_sys
    _boot_sys.path.insert(0, _boot_os.path.dirname(_boot_os.path.abspath(__file__)))
    import pyboot as _boot_pyboot
    _boot_pyboot.ensure_utf8_io()
except Exception:
    pass

import sys
try:
    from PIL import Image, ImageOps
except ImportError:  # v0.3.6：缺 Pillow 给中文安装指引，而不是裸 traceback
    sys.stderr.write(
        "❌ 缺少 Pillow（图像预处理依赖）。\n"
        "   安装：python3 -m pip install Pillow\n"
        "   或跳过预处理直接识别：scripts/ocr_image <图片>（会自动回退原图，精度可能下降）\n"
    )
    sys.exit(3)


def _preprocess_cli_help(argv):
    """海外适配轻量层：--lang en|zh 帮助文本；不影响原有 src/out 位置参数。"""
    _lang = "en" if ("--lang" in argv and argv[argv.index("--lang") + 1] == "en") else "zh"
    if "--help" in argv or "-h" in argv:
        if _lang == "en":
            print("usage: preprocess.py <input-image> <output-image> [--lang en|zh] [--deskew] [--binarize] [--upscale] [--rotate DEG] [--crop X,Y,W,H]")
        else:
            print("用法: preprocess.py <输入图> <输出图> [--lang en|zh] [--deskew] [--binarize] [--upscale] [--rotate 角度] [--crop X,Y,W,H]")
        return True
    return False


_arg_help = _preprocess_cli_help(sys.argv[1:])
if _arg_help:
    sys.exit(0)
if "--lang" in sys.argv[1:]:
    _i = sys.argv.index("--lang")
    if _i + 1 < len(sys.argv):
        sys.argv.pop(_i + 1)
    sys.argv.pop(_i)




def otsu_threshold(g):
    hist = g.histogram()
    total = g.width * g.height
    sum_all = sum(i * hist[i] for i in range(256))
    sum_b = w_b = 0
    best_t, best_var = 127, -1.0
    for t in range(256):
        w_b += hist[t]
        if w_b == 0 or w_b == total:
            continue
        w_f = total - w_b
        sum_b += t * hist[t]
        m_b = sum_b / w_b
        m_f = (sum_all - sum_b) / w_f
        var = w_b * w_f * (m_b - m_f) ** 2
        if var > best_var:
            best_var, best_t = var, t
    return best_t


def row_ink_variance(img):
    # 行墨量方差最大处即文字水平: 把图压成单列, 求各行均值方差
    inv = ImageOps.invert(img)
    col = inv.resize((1, inv.height))
    vals = [v if isinstance(v, int) else v[0] for v in col.getdata()]
    mean = sum(vals) / len(vals)
    return sum((v - mean) ** 2 for v in vals)


def deskew(g):
    work = g
    if min(g.size) > 800:
        k = 800.0 / min(g.size)
        work = g.resize((int(g.width * k), int(g.height * k)))
    best_a, best_s = 0.0, -1.0
    a = -5.0
    while a <= 5.0001:
        s = row_ink_variance(work.rotate(a, fillcolor=255, expand=True))
        if s > best_s:
            best_s, best_a = s, a
        a += 0.5
    if abs(best_a) >= 0.5:
        print("deskew %+.1f deg" % best_a, file=sys.stderr)
        return g.rotate(best_a, fillcolor=255, expand=True, resample=Image.BILINEAR)
    return g


src, out = sys.argv[1], sys.argv[2]
flags = sys.argv[3:]
im = Image.open(src)
im = ImageOps.exif_transpose(im)
im = im.convert('L')
if '--crop' in flags:
    try:
        x, y, w, h = (max(0, int(v)) for v in flags[flags.index('--crop') + 1].split(','))
        x2 = min(im.width, x + w)
        y2 = min(im.height, y + h)
        if x2 > x and y2 > y:
            im = im.crop((x, y, x2, y2))
        else:
            print('crop error: 裁剪区域超出图像范围，已忽略', file=sys.stderr)
    except Exception as e:
        print('crop error: %s' % e, file=sys.stderr)
if '--deskew' in flags:
    im = deskew(im)
if '--rotate' in flags:
    try:
        deg = int(flags[flags.index('--rotate') + 1]) % 360
        if deg:
            im = im.rotate(deg, expand=True, fillcolor=255, resample=Image.BILINEAR)
    except Exception as e:
        print("rotate error: %s" % e, file=sys.stderr)
im = ImageOps.autocontrast(im, cutoff=2)
# 放大对已经清晰的截图是伤害(实测精度下降), 只在字很可能太小时做
if '--upscale' in flags or max(im.size) <= 800:
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
if '--binarize' in flags:
    im = im.point(lambda p: 255 if p > otsu_threshold(im) else 0)
im.save(out)
