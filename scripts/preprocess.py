"""OCR 预处理: 灰度+autocontrast; 小图(<=800px)自动2x放大; --deskew(+-5deg) --binarize(Otsu) --upscale(强制放大) --rotate(90/180/270)"""
import sys
from PIL import Image, ImageOps


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
