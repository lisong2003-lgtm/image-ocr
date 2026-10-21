#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');

const MODELS = path.join(__dirname, '..', 'assets', 'tessdata');
const TESSDATA_BASE_URL = process.env.TESSDATA_BASE_URL || 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main';
const PSM_NAMES = { auto: 'AUTO', sparse: 'SPARSE_TEXT', block: 'SINGLE_BLOCK', line: 'SINGLE_LINE' };
const TMP = path.join(os.tmpdir(), `ocr-${process.pid}`);
const CJK = '[\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\u3000-\\u303F\\uFF01-\\uFF5E]';

function findTesseract() {
  const local = path.join(__dirname, 'node_modules', 'tesseract.js');
  if (fs.existsSync(path.join(local, 'package.json'))) return local;
  const runtimes = path.join(process.env.HOME || '', '.cache', 'codex-runtimes');
  if (fs.existsSync(runtimes)) {
    for (const entry of fs.readdirSync(runtimes)) {
      const p = path.join(runtimes, entry, 'dependencies', 'node', 'node_modules', 'tesseract.js');
      if (fs.existsSync(path.join(p, 'package.json'))) return p;
    }
  }
  try {
    return require.resolve('tesseract.js');
  } catch (_) {
    return null;
  }
}

function findPython() {
  if (process.env.CODEX_PYTHON && fs.existsSync(process.env.CODEX_PYTHON)) {
    return process.env.CODEX_PYTHON;
  }
  const runtimes = path.join(process.env.HOME || '', '.cache', 'codex-runtimes');
  if (fs.existsSync(runtimes)) {
    for (const entry of fs.readdirSync(runtimes)) {
      const p = path.join(runtimes, entry, 'dependencies', 'python', 'bin', 'python3');
      if (fs.existsSync(p)) return p;
    }
  }
  return 'python3';
}

function findBinary(name) {
  const runtimes = path.join(process.env.HOME || '', '.cache', 'codex-runtimes');
  if (fs.existsSync(runtimes)) {
    for (const entry of fs.readdirSync(runtimes)) {
      const p = path.join(runtimes, entry, 'dependencies', 'bin', 'override', name);
      if (fs.existsSync(p)) return p;
    }
  }
  for (const dir of (process.env.PATH || '').split(':')) {
    const p = path.join(dir, name);
    if (p !== name && fs.existsSync(p)) return p;
  }
  return null;
}

function usage(lang) {
  const en = lang === 'en';
  if (en) {
    console.log(`usage:
  ocr_image <image-or-pdf> [more files...] [options]

options:
  --ui-lang en|zh     UI language for help/summary (default zh; does NOT change OCR language)
  --lang chi_sim|eng  OCR language (default chi_sim)
  --psm auto|sparse|block|line  page segmentation mode (default auto)
  --whitelist "chars" only recognize these chars
  --no-preprocess     disable preprocessing (grayscale+contrast; small images auto-upscale 2x)
  --upscale           force 2x upscale
  --deskew            skew correction ±5°
  --binarize          Otsu binarization
  --json              per-line JSON with coordinates (conf/uncertain)
  --table             Markdown table by column clustering
  --csv               CSV table (for Excel)
  --out FILE          write output to file instead of stdout
  --auto-retry        auto retry binarize/deskew on low confidence (default on)
  --no-auto-retry     disable auto retry
  --auto-rotate       try 90/180/270 rotation when result is poor
  --page N            OCR only page N of PDF
  --max-pages N       OCR at most first N pages
  --dpi N             PDF render DPI (default 200)
  --auto-lang         auto detect language (default on)
  --no-auto-lang      disable auto language switch
  --code              code/screenshot mode
  --lang-list         list installed language models
  --download-langs a,b  download language models (network)
  --auto-download     auto download language packs (default on)
  --no-auto-download  disable auto download
  --crop x,y,w,h      OCR only this region
  --doctor            local OCR environment doctor
  --version           print version and exit
  --quiet             suppress summary output
  --workers N         parallel files (default 1, text mode only)
  --progress          progress on stderr
  --cache-ttl SEC     cache TTL (default 300)
  --no-cache          do not read/write cache
  --clear-cache       clear cache and exit
  --resume            read cache ignoring expiry
  --table-gap N       table column split threshold (px)
  --table-conf        include per-cell confidence in table
  --fields a,b        extract fields (date,amount,id) as JSON
  --crop-preview      save crop preview image`);
    return;
  }
  console.log(`用法:
  ocr_image <图片或PDF路径> [更多文件...] [选项]

选项:
  --ui-lang en|zh     UI 语言（默认 zh；不影响 --lang 的 OCR 语言）
  --lang chi_sim|eng   识别语言（默认 chi_sim，不要写 chi_sim+eng）
  --psm auto|sparse|block|line  页面分割模式（默认 auto）
  --whitelist "字符"   只识别指定字符，例如 "0123456789+-x×÷=()"
  （默认已做灰度+对比度增强，小图自动 2x 放大）
  --no-preprocess      关闭预处理，直接识别原图
  --upscale            强制 2x 放大（大图通常不需要）
  --deskew             倾斜校正 ±5°
  --binarize           Otsu 二值化（低对比扫描件）
  --json               输出带坐标的逐行结果（含 conf/uncertain）
  --table              输出 Markdown 表格（按坐标聚列）
  --csv                输出 CSV（按坐标聚列，可用于 Excel）
  --out 文件           把结果写入文件而不是 stdout
  --auto-retry         低置信度时自动重试 binarize/deskew（默认开启）
  --no-auto-retry      关闭自动重试
  --auto-rotate        结果不佳时自动尝试旋转 90/180/270 度
  --page N             PDF 只识别第 N 页
  --max-pages N        PDF 最多识别前 N 页
  --dpi N              PDF 渲染分辨率（默认 200，清晰度不够时用 300/400）
  --auto-lang          自动检测语言（日/韩/俄/阿/希伯来/英，默认开启）
  --no-auto-lang       关闭自动语言切换
  --code               代码/报错截图模式（保留空格缩进，不清理中文空格）
  --lang-list          列出已安装语言模型
  --download-langs a,b 下载语言模型（如 jpn,kor,rus，联网）
  --auto-download      按系统语言/识别需求自动下载语言包（默认开启）
  --no-auto-download   关闭自动下载
  --crop x,y,w,h      只识别该区域（原图坐标，先裁剪再其他预处理）
  --doctor            本机 OCR 环境体检（中文报告）
  --version           输出版本号并退出
  --quiet             抑制 summary 等提示（保留低置信度核对警告）
  --workers N         多文件并行（默认 1，仅文本模式；--json/--table/--csv/--out 不支持）
  --progress          批量识别时在 stderr 输出进度（已完成/总数）
  --cache-ttl 秒     缓存有效期（默认 300 秒）
  --no-cache          本次不读写缓存
  --clear-cache       清空缓存后退出
  --resume            读取缓存时忽略过期时间（断点续跑）
  --table-gap N       表格列切分阈值（像素，默认自动）
  --table-conf        表格输出附每格置信度
  --fields a,b        抽取字段（date,amount,id），输出 JSON（只抽实际读到的，不补全）
  --crop-preview      --crop 时保存裁剪预览图并输出路径`);
}

function parseArgs(argv) {
  const opts = { _: [], uiLang: 'zh', lang: 'chi_sim', psm: 'auto', whitelist: null, preprocess: true, deskew: false, binarize: false, upscale: false, json: false, table: false, csv: false, out: null, autoRetry: true, autoRotate: false, page: null, maxPages: null, dpi: 200, autoLang: true, code: false, langList: false, downloadLangs: null, autoDownload: true, langExplicit: false, crop: null, doctor: false, version: false, quiet: false, workers: 1, cacheTtl: null, noCache: false, clearCache: false, resume: false, progress: false, tableGap: null, tableConf: false, fields: null, cropPreview: false, alwaysLabel: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ui-lang') { opts.uiLang = ['en','en-US'].includes(argv[++i] || 'zh') ? 'en' : 'zh'; }
    else if (a === '--lang') { opts.lang = argv[++i]; opts.langExplicit = true; }
    else if (a === '--psm') opts.psm = argv[++i];
    else if (a === '--whitelist') opts.whitelist = argv[++i];
    else if (a === '--preprocess') opts.preprocess = true;
    else if (a === '--no-preprocess') opts.preprocess = false;
    else if (a === '--upscale') opts.upscale = true;
    else if (a === '--deskew') { opts.deskew = true; opts.preprocess = true; }
    else if (a === '--binarize') { opts.binarize = true; opts.preprocess = true; }
    else if (a === '--json') opts.json = true;
    else if (a === '--table') opts.table = true;
    else if (a === '--csv') opts.csv = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--auto-retry') opts.autoRetry = true;
    else if (a === '--no-auto-retry') opts.autoRetry = false;
    else if (a === '--auto-rotate') opts.autoRotate = true;
    else if (a === '--page') opts.page = parseInt(argv[++i], 10);
    else if (a === '--max-pages') opts.maxPages = parseInt(argv[++i], 10);
    else if (a === '--dpi') opts.dpi = parseInt(argv[++i], 10);
    else if (a === '--auto-lang') opts.autoLang = true;
    else if (a === '--no-auto-lang') opts.autoLang = false;
    else if (a === '--code') opts.code = true;
    else if (a === '--lang-list') opts.langList = true;
    else if (a === '--download-langs') opts.downloadLangs = argv[++i];
    else if (a === '--auto-download') opts.autoDownload = true;
    else if (a === '--no-auto-download') opts.autoDownload = false;
    else if (a === '--crop') opts.crop = argv[++i];
    else if (a === '--doctor') opts.doctor = true;
    else if (a === '--version') opts.version = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--workers') opts.workers = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--cache-ttl') opts.cacheTtl = parseInt(argv[++i], 10);
    else if (a === '--no-cache') opts.noCache = true;
    else if (a === '--clear-cache') opts.clearCache = true;
    else if (a === '--resume') opts.resume = true;
    else if (a === '--progress') opts.progress = true;
    else if (a === '--table-gap') opts.tableGap = parseInt(argv[++i], 10);
    else if (a === '--table-conf') opts.tableConf = true;
    else if (a === '--fields') opts.fields = String(argv[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
    else if (a === '--crop-preview') opts.cropPreview = true;
    else if (a === '--_always-label') opts.alwaysLabel = true;
    else if (a.startsWith('-')) { usage(opts.uiLang); process.exit(1); }
    else opts._.push(a);
  }
  if (opts.deskew || opts.binarize || opts.upscale) opts.preprocess = true;
  if (opts.table || opts.csv) opts.json = false;
  return opts;
}

function cleanCjk(text) {
  const re = new RegExp(`(${CJK})[ \\t]+(?=${CJK})`, 'g');
  let prev;
  do { prev = text; text = text.replace(re, '$1'); } while (text !== prev);
  return text;
}

let seq = 0;

function pickCacheDir() {
  const candidates = [
    process.env.XDG_CACHE_HOME,
    process.env.IMAGE_OCR_CACHE,
    path.join(os.homedir(), '.cache')
  ];
  for (const base of candidates) {
    if (!base) continue;
    const dir = path.join(base, 'image-ocr-cache');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (_) {}
  }
  return null;
}
const OCR_CACHE = pickCacheDir();
let CACHE_TTL_MS = 5 * 60 * 1000;
const LOW_CONF = 60;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function cacheKey(inputs, opts) {
  let payload = '';
  for (const p of inputs) {
    try {
      const st = fs.statSync(p);
      payload += `${p}\0${st.size}:${st.mtimeMs}\0${sha256(fs.readFileSync(p))}`;
    } catch (_) { payload += `${p}\0missing`; }
  }
  payload += '\0' + JSON.stringify({ lang: opts.lang, psm: opts.psm, whitelist: opts.whitelist, preprocess: opts.preprocess, deskew: opts.deskew, binarize: opts.binarize, upscale: opts.upscale, json: opts.json, table: opts.table, csv: opts.csv, autoRetry: opts.autoRetry, autoRotate: opts.autoRotate, page: opts.page, maxPages: opts.maxPages, dpi: opts.dpi, autoLang: opts.autoLang, code: opts.code, autoDownload: opts.autoDownload, crop: opts.crop, tableGap: opts.tableGap, tableConf: opts.tableConf, fields: opts.fields });
  return sha256(Buffer.from(payload));
}

function readCache(key, ignoreTtl) {
  if (!OCR_CACHE) return null;
  try {
    const f = path.join(OCR_CACHE, key + '.json');
    if (!fs.existsSync(f)) return null;
    const st = fs.statSync(f);
    if (!ignoreTtl && Date.now() - st.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) { return null; }
}

function clearCacheDir() {
  if (!OCR_CACHE) return -1;
  let n = 0;
  for (const f of fs.readdirSync(OCR_CACHE)) {
    if (!f.endsWith('.json') && !f.startsWith('crop-preview-')) continue;
    try { fs.unlinkSync(path.join(OCR_CACHE, f)); n++; } catch (_) {}
  }
  return n;
}

function writeCache(key, obj) {
  if (!OCR_CACHE) return;
  try {
    fs.mkdirSync(OCR_CACHE, { recursive: true });
    // 顺手清理过期缓存，避免长期积累
    for (const f of fs.readdirSync(OCR_CACHE)) {
      if (!f.endsWith('.json')) continue;
      const fp = path.join(OCR_CACHE, f);
      try {
        const st = fs.statSync(fp);
        if (Date.now() - st.mtimeMs > CACHE_TTL_MS) fs.unlinkSync(fp);
      } catch (_) {}
    }
    fs.writeFileSync(path.join(OCR_CACHE, key + '.json'), JSON.stringify(obj));
  } catch (_) {}
}

function preprocess(src, flags) {
  fs.mkdirSync(TMP, { recursive: true });
  const out = path.join(TMP, `pre_${++seq}.png`);
  const args = [path.join(__dirname, 'preprocess.py'), src, out];
  if (flags && flags.binarize) args.push('--binarize');
  if (flags && flags.deskew) args.push('--deskew');
  if (flags && flags.upscale) args.push('--upscale');
  if (flags && flags.rotate) args.push('--rotate', String(flags.rotate));
  if (flags && flags.crop) args.push('--crop', String(flags.crop));
  const r = spawnSync(findPython(), args, { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) {
    if (r.stderr) console.error(r.stderr.trim());
    return src;
  }
  return out;
}

function renderPdf(pdf, opts) {
  fs.mkdirSync(TMP, { recursive: true });
  const bin = findBinary('pdftoppm');
  if (bin) {
    const prefix = path.join(TMP, `pdf${++seq}`);
    const ppArgs = ['-png', '-r', String(opts.dpi || 200)];
    if (opts.page) { ppArgs.push('-f', String(opts.page), '-l', String(opts.page)); }
    else if (opts.maxPages) { ppArgs.push('-l', String(opts.maxPages)); }
    ppArgs.push(pdf, prefix);
    const r = spawnSync(bin, ppArgs, { encoding: 'utf8' });
    if (r.status === 0) {
      const base = path.basename(prefix);
      const pages = fs.readdirSync(TMP).filter((f) => f.startsWith(base) && f.endsWith('.png'));
      pages.sort((a, b) => { const n = (x) => parseInt((x.match(/(\d+)\.png$/) || [,'0'])[1], 10); return n(a) - n(b); });
      if (pages.length) return pages.map((f) => path.join(TMP, f));
    }
  }
  const out = path.join(TMP, `pdf1p_${++seq}.png`);
  if (process.platform === 'darwin') {
    const r2 = spawnSync(findBinary('sips') || 'sips', ['-s', 'format', 'png', pdf, '--out', out], { encoding: 'utf8' });
    if (r2.status === 0 && fs.existsSync(out)) {
      console.error('warn: 仅能转第 1 页（未找到 pdftoppm，--page/--max-pages 不生效）');
      return [out];
    }
  } else {
    const magick = findBinary('magick') || findBinary('convert');
    if (magick) {
      const r3 = spawnSync(magick, ['-density', String(opts.dpi || 200), `${pdf}[0]`, out], { encoding: 'utf8' });
      if (r3.status === 0 && fs.existsSync(out)) {
        console.error('warn: 仅能转第 1 页（未找到 pdftoppm，--page/--max-pages 不生效）');
        return [out];
      }
    }
  }
  const hint = process.platform === 'darwin' ? 'brew install poppler' : (process.platform === 'win32' ? '安装 poppler 并把 pdftoppm.exe 加入 PATH' : 'apt install poppler-utils / dnf install poppler-utils');
  console.error(`[转换失败] PDF 转换失败: ${pdf}（安装 poppler 提供 pdftoppm 后重试：${hint}）`);
  return [];
}

function extractItems(paths, opts) {
  const items = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) { console.error(`文件不存在: ${p}`); continue; }
    if (p.toLowerCase().endsWith('.pdf')) {
      renderPdf(p, opts).forEach((f, i) => {
        const actualPage = opts.page || (opts.maxPages ? i + 1 : i + 1);
        items.push({ image: f, label: `${p} [第${actualPage}页]` });
      });
    } else if (/\.heic$/i.test(p)) {
      const out = path.join(TMP, `heic_${++seq}.png`);
      let converted = false;
      if (process.platform === 'darwin') {
        const r = spawnSync(findBinary('sips') || 'sips', ['-s', 'format', 'png', p, '--out', out], { encoding: 'utf8' });
        converted = r.status === 0 && fs.existsSync(out);
      }
      if (!converted) {
        const magick = findBinary('magick') || findBinary('convert');
        if (magick) {
          const r2 = spawnSync(magick, [p, out], { encoding: 'utf8' });
          converted = r2.status === 0 && fs.existsSync(out);
        }
      }
      if (!converted) {
        const heif = findBinary('heif-convert');
        if (heif) {
          const r3 = spawnSync(heif, [p, out], { encoding: 'utf8' });
          converted = r3.status === 0 && fs.existsSync(out);
        }
      }
      if (converted) items.push({ image: out, label: `${p}（HEIC 已转 PNG）` });
      else console.error(`[格式不支持] HEIC 转换失败: ${p}（macOS 用 sips；其他系统装 ImageMagick 或 libheif 的 heif-convert，或先手动转 PNG）`);
      continue;
    } else if (IMAGE_EXT.test(p)) {
      items.push({ image: p, label: p });
    } else {
      console.error(`不支持的格式: ${p}（仅支持 PNG/JPG/WEBP/GIF/BMP/TIFF 或 PDF）`);
    }
  }
  return items;
}

function lineResults(data) {
  const lines = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const b = line.bbox;
        lines.push({ text: line.text.trim(), conf: line.confidence, uncertain: line.confidence < LOW_CONF, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      }
    }
  }
  lines.sort((a, b) => (Math.abs(a.y0 - b.y0) > 12 ? a.y0 - b.y0 : a.x0 - b.x0));
  return lines;
}

function collectWords(data) {
  const words = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const w of line.words || []) {
          if (w.text && w.text.trim()) {
            words.push({ text: w.text.trim(), conf: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, rowY: line.bbox.y0, lineConfidence: line.confidence });
          }
        }
      }
    }
  }
  return words;
}

function joinWords(words) {
  const s = words.map((w) => (w.conf != null && w.conf < LOW_CONF ? w.text + '⚠️' : w.text)).join(' ');
  return cleanCjk(s).trim();
}

function csvEscape(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function buildTable(results, fmt, gapOverride, withConf) {
  const out = [];
  for (const r of results) {
    if (r.multi) out.push(`=== ${r.item.label} ===`);
    const words = collectWords(r.data);
    if (!words.length) continue;
    // 按行 y 分组
    const rows = new Map();
    for (const w of words) {
      const key = Math.round(w.rowY / 12);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(w);
    }
    const rowKeys = [...rows.keys()].sort((a, b) => a - b);
    const grid = rowKeys.map((k) => {
      const ws = rows.get(k).sort((a, b) => a.x0 - b.x0);
      // 用词间间距做列切分
      const cells = [];
      let cur = [ws[0]];
      const medianW = [...ws].map((w) => w.x1 - w.x0).sort((a, b) => a - b)[Math.floor(ws.length / 2)] || 8;
      const gapTh = gapOverride ? Math.max(1, gapOverride) : Math.max(6, medianW * 0.7);
      for (let i = 1; i < ws.length; i++) {
        if (ws[i].x0 - ws[i - 1].x1 > gapTh) { cells.push(joinWords(cur)); cur = [ws[i]]; }
        else cur.push(ws[i]);
      }
      const cellText = joinWords(cur) + (withConf ? `(${Math.round(Math.min(...cur.map((w) => w.conf)))})` : '');
      cells.push(cellText);
      return cells;
    });
    const maxCols = Math.max(...grid.map((g) => g.length));
    const padded = grid.map((g) => {
      while (g.length < maxCols) g.push('');
      return g;
    });
    if (fmt === 'csv') {
      out.push(padded.map((row) => row.map(csvEscape).join(',')).join('\n'));
    } else {
      out.push(padded.map((row) => `| ${row.join(' | ')} |`).join('\n').replace('\n', '\n| ' + padded[0].map(() => '---').join(' | ') + ' |\n'));
    }
  }
  return out.join('\n');
}

function asciiRatio(lines) {
  const t = lines.map((l) => l.text).join('');
  const letters = (t.match(/[A-Za-z0-9]/g) || []).length;
  const visible = t.replace(/\s/g, '').length;
  return visible ? letters / visible : 0;
}

function detectLang(text) {
  // 按字符集粗判：日文假名/韩文谚文/西里尔/阿拉伯/希伯来/纯拉丁
  if (/[\u3040-\u30FF\uFF66-\uFF9D]/.test(text)) return 'jpn';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'kor';
  if (/[\u0400-\u04FF]/.test(text)) return 'rus';
  if (/[\u0600-\u06FF]/.test(text)) return 'ara';
  if (/[\u0590-\u05FF]/.test(text)) return 'heb';
  const visible = text.replace(/\s/g, '');
  const latin = (visible.match(/[A-Za-z0-9]/g) || []).length;
  return visible && latin / visible > 0.5 ? 'eng' : null;
}

function listModels() {
  try {
    return fs.readdirSync(MODELS).filter((f) => f.endsWith('.traineddata')).map((f) => path.basename(f, '.traineddata')).sort();
  } catch (_) { return []; }
}

function localeToLang(locale, map) {
  if (!locale) return null;
  // 兼容 zh-Hans-CN / zh_CN.UTF-8 / ja_JP / en_US 等格式
  const norm = String(locale).replace(/_/g, '-').trim();
  const head = norm.split(/[-._]/)[0];
  for (const [re, lang] of map) if (re.test(norm) || re.test(head)) return lang;
  return null;
}

function systemLang() {
  const map = [
    [/^zh/i, 'chi_sim'], [/^en/i, 'eng'], [/^ja/i, 'jpn'], [/^ko/i, 'kor'],
    [/^ru/i, 'rus'], [/^ar/i, 'ara'], [/^he/i, 'heb'], [/^de/i, 'deu'],
    [/^fr/i, 'fra'], [/^es/i, 'spa'], [/^it/i, 'ita'], [/^pt/i, 'por'],
    [/^th/i, 'tha'], [/^vi/i, 'vie']
  ];
  const candidates = [];

  // macOS: AppleLanguages / AppleLocale
  try {
    const r = spawnSync('defaults', ['read', '-g', 'AppleLanguages'], { encoding: 'utf8', timeout: 2000 });
    const m = r && r.stdout && r.stdout.match(/"([^"]+)"/);
    if (m) candidates.push(m[1] || '');
  } catch (_) {}
  try {
    const r2 = spawnSync('defaults', ['read', '-g', 'AppleLocale'], { encoding: 'utf8', timeout: 2000 });
    if (r2 && r2.stdout) candidates.push(String(r2.stdout).trim());
  } catch (_) {}

  // Linux / BSD / macOS 通用：locale 环境变量
  for (const k of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
    if (process.env[k]) candidates.push(process.env[k]);
  }

  // Windows: PowerShell 输出语言代码
  try {
    if (process.platform === 'win32') {
      const pw = process.env.ComSpec ? 'powershell' : findBinary('powershell');
      const r3 = spawnSync(pw || 'powershell', ['-NoProfile', '-Command', '(Get-Culture).Name'], { encoding: 'utf8', timeout: 3000 });
      if (r3 && r3.stdout) candidates.push(String(r3.stdout).trim());
    }
  } catch (_) {}

  for (const c of candidates) {
    const lang = localeToLang(c, map);
    if (lang) return lang;
  }
  return null;
}

let AUTO_DOWNLOAD = false;
const PREFS_FILE = (OCR_CACHE || path.join(os.tmpdir(), 'image-ocr-cache')) + path.sep + 'prefs.json';

function loadPrefs() {
  try {
    if (fs.existsSync(PREFS_FILE)) return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
  } catch (_) {}
  return { usedLangs: [] };
}

function savePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs));
  } catch (_) {}
}

function markUsedLang(lang) {
  if (!lang) return;
  const prefs = loadPrefs();
  if (!prefs.usedLangs.includes(lang)) {
    prefs.usedLangs.push(lang);
    savePrefs(prefs);
  }
}

// 纯 Node 下载语言模型：Windows / Linux / macOS 通用，不依赖 bash/curl
const DL_SCRIPT = [
  "const https=require('https'),fs=require('fs'),path=require('path');",
  "const lang=process.argv[1],dir=process.argv[2],base=process.argv[3];",
  "const out=path.join(dir,lang+'.traineddata');",
  "if(fs.existsSync(out)){console.error('已存在: '+lang+'.traineddata');process.exit(0);}",
  "const tmp=out+'.tmp';",
  "function get(u){https.get(u,{headers:{'User-Agent':'image-ocr/0.3.0'}},r=>{",
  " if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();get(new URL(r.headers.location,u).href);return;}",
  " if(r.statusCode!==200){r.resume();console.error('HTTP '+r.statusCode);process.exit(1);}",
  " const f=fs.createWriteStream(tmp);r.pipe(f);",
  " f.on('finish',()=>f.close(()=>{",
  "  if(fs.existsSync(tmp)&&fs.statSync(tmp).size>50000){fs.renameSync(tmp,out);console.error('已安装: '+out);}",
  "  else{try{fs.unlinkSync(tmp)}catch(e){}console.error('下载文件异常（过小）');process.exit(1);}}));",
  " f.on('error',e=>{try{fs.unlinkSync(tmp)}catch(_){}console.error(e.message);process.exit(1);});",
  "}).on('error',e=>{console.error(e.message);process.exit(1);});}",
  "get(base+'/'+lang+'.traineddata');"
].join('\n');

function ensureModel(lang) {
  if (fs.existsSync(path.join(MODELS, `${lang}.traineddata`))) return true;
  if (!AUTO_DOWNLOAD) return false;
  const r = spawnSync(process.execPath || 'node', ['-e', DL_SCRIPT, lang, MODELS, TESSDATA_BASE_URL], { encoding: 'utf8', timeout: 180000 });
  if (r.stderr) console.error(String(r.stderr).trim().split('\n').filter((x) => x && !/^已存在/.test(x)).join('\n'));
  const ok = fs.existsSync(path.join(MODELS, `${lang}.traineddata`));
  if (ok) markUsedLang(lang);
  return ok;
}

function ensureSystemAndUsedLangs() {
  if (!AUTO_DOWNLOAD) return;
  const prefs = loadPrefs();
  const want = new Set(prefs.usedLangs || []);
  const sl = systemLang();
  if (sl) want.add(sl);
  for (const lang of want) {
    if (!fs.existsSync(path.join(MODELS, `${lang}.traineddata`))) {
      ensureModel(lang);
    }
  }
}

function avgConfOfLines(lines) {
  if (!lines.length) return 0;
  return lines.reduce((a, l) => a + l.conf, 0) / lines.length;
}

function lowRatio(lines) {
  if (!lines.length) return 1;
  return lines.filter((l) => l.uncertain).length / lines.length;
}

function scoreOf(lines) {
  if (!lines.length) return -1;
  const avg = avgConfOfLines(lines);
  const textLen = lines.reduce((a, l) => a + l.text.length, 0);
  return avg - lowRatio(lines) * 15 + Math.min(textLen, 2000) / 100;
}

function isPoor(lines) {
  if (!lines.length) return true;
  return avgConfOfLines(lines) < 55 || lowRatio(lines) > 0.3;
}

function bestWindowKey(best, worker, opts) {
  return opts.autoLang && opts.lang !== 'eng' && best.lang && best.lang === 'eng';
}

// 结构化字段抽取：只抽取 OCR 实际读到的内容，读不到就留空，不补全不推算
function extractFields(text, lines, fieldsList) {
  const defs = {
    date: /(?:19|20)\d{2}[-/.年]\s?\d{1,2}[-/.月]\s?\d{1,2}日?/g,
    amount: /(?:¥|￥|\$|RMB|CNY|USD)\s?\d[\d,.]*|\d[\d,.]*\s?(?:元|美元)/g,
    id: /\b[A-Z0-9][A-Z0-9-]{5,}\b/g
  };
  const out = {};
  const want = fieldsList || [];
  for (const name of want) {
    const re = defs[name];
    if (!re) { out[name] = null; continue; }
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = String(l.text || '').match(re);
      if (m) for (const v of m) found.push({ value: v, line: i + 1, conf: Math.round(l.conf) });
    }
    out[name] = found.length ? found : null;
  }
  return out;
}


const DOCTOR_PNG_B64 = "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";

async function doctor() {
  const report = [];
  const mark = (ok, k) => { report.push(`${ok ? '✅' : '❌'} ${k}`); return ok; };
  const tessPath = findTesseract();
  const okTess = mark(!!tessPath, 'tesseract.js（本地 wasm OCR）');
  report.push(`    ├ 语言模型: ${listModels().join(', ') || '无'}`);
  const py = findPython();
  let okPillow = false;
  try {
    const r = spawnSync(py, ['-c', 'from PIL import Image; print(Image.__version__)'], { encoding: 'utf8', timeout: 15000 });
    okPillow = r.status === 0;
  } catch (_) {}
  mark(okPillow, 'Python + Pillow（图片预处理）');
  report.push(`${findBinary('pdftoppm') ? '✅' : '⚠️'} pdftoppm（PDF 多页：${findBinary('pdftoppm') ? '已安装' : '未安装，仅能转 PDF 第 1 页，可 brew install poppler'}）`);
  report.push(`${OCR_CACHE ? '✅' : '⚠️'} 缓存目录：${OCR_CACHE || '未启用'}`);
  let okSelf = false;
  let selfText = '';
  if (okTess) {
    try {
      fs.mkdirSync(TMP, { recursive: true });
      const png = path.join(TMP, 'doctor_sample.png');
      fs.writeFileSync(png, Buffer.from(DOCTOR_PNG_B64, 'base64'));
      const { createWorker, OEM } = require(tessPath);
      const w = await createWorker('eng', OEM.LSTM_ONLY, { langPath: MODELS, gzip: false });
      const ret = await w.recognize(png);
      selfText = (ret && ret.data && ret.data.text || '').trim().replace(/\n+/g, ' ');
      okSelf = /OCR 2026 OK/.test(selfText);
      await w.terminate();
    } catch (e) {
      selfText = '识别失败: ' + (e.message || e);
    }
  }
  report.push(`${mark(okSelf, '微型自检识别（期望读出 “OCR 2026 OK”）')}`);
  report[report.length - 1] = `${okSelf ? '✅' : '❌'} 微型自检识别→UTF8:${JSON.stringify(selfText.slice(0, 40))}`;
  report.forEach((l) => console.log(l));
  const allOk = okTess && okPillow && okSelf;
  console.log(opts.uiLang === 'en' ? (allOk ? 'doctor: all checks passed ✅' : 'doctor: issues found ❌ (fix per hints above then retry)') : (allOk ? 'doctor: 全部通过 ✅（可正常识别）' : 'doctor: 存在缺项 ❌（按上面提示修复后重试）'));
  return allOk ? 0 : 1;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  AUTO_DOWNLOAD = opts.autoDownload;
  const t0 = Date.now();
  if (opts.version) { console.log(opts.uiLang === 'en' ? 'image-ocr 0.3.3' : 'image-ocr 0.3.3'); process.exit(0); }
  if (opts.doctor) { process.exit(await doctor()); }
  if (opts.clearCache) {
    const n = clearCacheDir();
    console.log(n < 0 ? '缓存目录未启用' : `已清理缓存文件: ${n}`);
    process.exit(0);
  }
  if (opts.cacheTtl) CACHE_TTL_MS = Math.max(1, opts.cacheTtl) * 1000;
  if (opts.workers > 1 && opts._.length > 1) {
    if (opts.json || opts.table || opts.csv || opts.out) {
      console.error('[参数冲突] --workers 仅支持文本输出，--json/--table/--csv/--out 请分批或单文件运行');
      process.exit(1);
    }
    const files = new Set(opts._);
    const passthrough = [];
    const all = process.argv.slice(2);
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (files.has(a)) continue;
      if (a === '--workers') { i++; continue; }
      passthrough.push(a);
    }
    passthrough.push('--_always-label');
    const chunkSize = Math.ceil(opts._.length / opts.workers);
    const chunks = [];
    for (let i = 0; i < opts._.length; i += chunkSize) chunks.push(opts._.slice(i, i + chunkSize));
    let bad = 0;
    for (const chunk of chunks) {
      const r = spawnSync(process.execPath, [__filename, ...chunk, ...passthrough], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr && r.stderr.trim()) process.stderr.write(r.stderr.trim().replace(/\n?$/, '') + '\n');
      if (r.status) bad = r.status;
    }
    process.exit(bad);
  }
  if (opts.langList) {
    const langs = listModels();
    console.log('已安装语言模型: ' + (langs.length ? langs.join(', ') : '无'));
    process.exit(0);
  }
  if (opts.downloadLangs) {
    const want = String(opts.downloadLangs).split(',').map((x) => x.trim()).filter(Boolean);
    let bad = 0;
    for (const lang of want) {
      console.error('下载 ' + lang + ' ...');
      if (!ensureModel(lang)) { console.error('❌[下载] ' + lang + ' 失败'); bad = 1; }
    }
    console.error('DONE');
    process.exit(bad);
  }
  if (!opts._.length) { usage(opts.uiLang); process.exit(1); }

  // 联网可用时：预装系统语言 + 历史常用语言
  ensureSystemAndUsedLangs();

  // 未显式 --lang 时按系统语言选择默认模型
  if (!opts.langExplicit) {
    const sl = systemLang();
    if (sl) opts.lang = sl;
  }
  if (!fs.existsSync(path.join(MODELS, `${opts.lang}.traineddata`)) && !ensureModel(opts.lang)) {
    console.error(`[缺模型] 缺少语言模型: ${opts.lang}` + (opts.autoDownload ? '（自动下载失败，可稍后重试 ocr_image --download-langs '+opts.lang+'）' : '（可运行 ocr_image --download-langs '+opts.lang+'）'));
    console.error(`可用模型: ${listModels().join(', ') || '无'}`);
    process.exit(1);
  }

  const tessPath = findTesseract();
  if (!tessPath) {
    console.error('[缺依赖] 找不到 tesseract.js');
    console.error('安装指引：检查并恢复 Codex 运行时缓存');
    process.exit(1);
  }
  const { createWorker, OEM, PSM } = require(tessPath);

  const cache = opts.noCache ? null : readCache(cacheKey(opts._, opts), opts.resume);
  if (cache) {
    if (cache.warnings && cache.warnings.length) console.error('warn: ' + cache.warnings.join('；'));
    if (cache.out) {
      if (opts.out) {
        fs.writeFileSync(opts.out, cache.out);
        process.stdout.write(opts.uiLang === 'en' ? `OCR result written to: ${opts.out}\n` : `OCR 结果已写入: ${opts.out}\n`);
      } else {
        process.stdout.write(cache.out);
      }
    }
    process.exit(0);
  }

  const items = extractItems(opts._, opts);
  if (!items.length) process.exit(1);
  const multi = items.length > 1;

  const workers = new Map();
  async function getWorker(lang) {
    if (workers.has(lang)) return workers.get(lang);
    if (!fs.existsSync(path.join(MODELS, `${lang}.traineddata`))) {
      if (!ensureModel(lang)) return null;
    }
    try {
      const w = await createWorker(lang, OEM.LSTM_ONLY, {
        langPath: MODELS,
        gzip: false,
        cachePath: path.join(os.tmpdir(), 'tesscache-reuse'),
        cacheMethod: 'none',
        logger: () => {},
        debug: () => {}
      });
      const params = { tessedit_pageseg_mode: PSM[PSM_NAMES[opts.psm]] };
      if (opts.whitelist) params.tessedit_char_whitelist = opts.whitelist;
      if (opts.code) params.tessedit_preserve_interword_spaces = '1';
      await w.setParameters(params);
      w._lang = lang;
      markUsedLang(lang);
      workers.set(lang, w);
      return w;
    } catch (e) {
      console.error(`[模型失败] ${lang} 模型不可用，已跳过（${e.message || e}）`);
      workers.set(lang, null);
      return null;
    }
  }
  for (const l of listModels()) { if (l !== opts.lang) await getWorker(l); }
  const mainWorker = await getWorker(opts.lang);

  const baseFlags = { binarize: opts.binarize, deskew: opts.deskew, upscale: opts.upscale, rotate: 0, crop: opts.crop };
  const variants = [baseFlags];
  if (opts.autoRotate) variants.push({ ...baseFlags, rotate: 90 }, { ...baseFlags, rotate: 180 }, { ...baseFlags, rotate: 270 });

  const results = [];
  try {
    for (const item of items) {
      const attempt = async (worker, flags) => {
        let target = item.image;
        let pre = null;
        if (opts.preprocess) {
          target = preprocess(item.image, flags);
          if (target !== item.image) pre = target;
        }
        const ret = await worker.recognize(target, { rotateAuto: true }, { blocks: true });
        const lines = lineResults(ret.data);
        return { item, data: ret.data, pre, lines, lang: worker && worker._lang || null, flags, score: scoreOf(lines), poor: isPoor(lines) };
      };

      let best = await attempt(mainWorker, variants[0]);
      let bestWorker = mainWorker;
      // 按字符集粗判语言；首轮结果差时再尝试已安装的其他语言
      if (opts.autoLang) {
        const detected = detectLang(best.lines.map((l) => l.text).join(''));
        const candidates = [];
        if (detected && detected !== opts.lang) candidates.push(detected);
        else if (asciiRatio(best.lines) > 0.5 && 'eng' !== opts.lang) candidates.push('eng');
        if (best.poor) {
          for (const l of listModels()) {
            if (l !== opts.lang && !candidates.includes(l)) candidates.push(l);
          }
        }
        for (const targetLang of candidates) {
          if (!fs.existsSync(path.join(MODELS, targetLang + '.traineddata')) && !ensureModel(targetLang)) continue;
          const altWorker = await getWorker(targetLang);
          if (!altWorker) continue;
          const cand = await attempt(altWorker, variants[0]);
          if (cand.score > best.score) { best = cand; bestWorker = altWorker; }
        }
      }
      const retryFlags = [];
      if (opts.autoRetry) {
        if (!opts.binarize) retryFlags.push({ ...baseFlags, binarize: true });
        if (!opts.deskew && best.poor) retryFlags.push({ ...baseFlags, deskew: true });
        if (best.poor && opts.autoRotate) {
          for (const rv of variants.slice(1)) retryFlags.push(rv);
        }
        for (const rf of retryFlags) {
          const candidate = await attempt(bestWorker, rf);
          if (candidate.score > best.score || (best.poor && !candidate.poor)) { best = candidate; }
        }
      } else if (best.poor && opts.autoRotate) {
        for (const rv of variants.slice(1)) {
          const candidate = await attempt(bestWorker, rv);
          if (candidate.score > best.score || (best.poor && !candidate.poor)) best = candidate;
        }
      }
      if (best.flags && best.flags.rotate && !opts.quiet) console.error(`warn: ${item.label} 使用了旋转 ${best.flags.rotate}° 结果`);
      if (bestWindowKey(best, bestWorker, opts) && !opts.quiet) console.error(`warn: ${item.label} 自动切换为 eng 识别`);
      if (!opts.quiet && best.flags && best.flags.binarize && !baseFlags.binarize) console.error(`warn: ${item.label} 自动启用 binarize（低对比）`);
      if (!opts.quiet && best.flags && best.flags.deskew && !baseFlags.deskew) console.error(`warn: ${item.label} 自动启用 deskew（倾斜）`);
      if (opts.cropPreview && best.pre && fs.existsSync(best.pre)) {
        try {
          const pdir = OCR_CACHE || path.join(os.tmpdir(), 'image-ocr-previews');
          fs.mkdirSync(pdir, { recursive: true });
          const dst = path.join(pdir, 'crop-preview-' + String(item.label).replace(/[^^\w.-]+/g, '_').slice(-80) + '.png');
          fs.copyFileSync(best.pre, dst);
          if (!opts.quiet) console.error(`preview: ${dst}`);
        } catch (_) {}
      }
      results.push(best);
      if (opts.progress) console.error(`progress: ${results.length}/${items.length}`);
    }
  } finally {
    for (const w of workers.values()) await w.terminate();
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  let outStr = '';
  const warnings = [];
  for (const r of results) {
    const lines = r.lines;
    const low = lines.filter((l) => l.uncertain);
    const cropNote = opts.crop ? `；裁剪区域 ${opts.crop}` : '';
    let detail = '';
    if (low.length) {
      const details = low.slice(0, 3).map((l) => {
        const idx = lines.indexOf(l) + 1;
        return `行${idx} "${String(l.text).slice(0, 30)}" conf=${Math.round(l.conf)}`;
      }).join('；');
      detail = `${low.length} 行置信度<${LOW_CONF}（${details}${cropNote}）`;
      warnings.push(`${r.item.label}: ${detail}，需人工核对`);
    } else if (r.poor) {
      detail = `未读到足够文字/整体置信度偏低${cropNote}`;
      warnings.push(`${r.item.label}: ${detail}，需人工核对`);
    }
    const manual = low.length > 0 || r.poor;
    const manualNote = manual ? `【需人工核对】${r.item.label}：${detail}。请与原始图片人工比对，勿当最终结果。\n` : '';
    if (opts.fields) {
      const rawTextF = opts.code ? r.data.text : cleanCjk(r.data.text);
      const out = { image: r.item.label, fields: extractFields(rawTextF, lines, opts.fields) };
      if (manual) { out.needs_review = true; out.review_note = detail; }
      outStr += JSON.stringify(out) + '\n';
      continue;
    }
    if (opts.table || opts.csv) {
      if (multi) outStr += `=== ${r.item.label} ===\n`;
      if (manual && !opts.csv) outStr += `> ${manualNote.replace(/\n$/, '')}\n\n`;
      outStr += buildTable([r], opts.csv ? 'csv' : 'md', opts.tableGap, opts.tableConf) + '\n';
      continue;
    }
    if (opts.json) {
      const converted = { image: r.item.label, lines: lines };
      if (manual) { converted.needs_review = true; converted.review_note = detail; }
      outStr += (multi ? JSON.stringify(converted) : '') ;
      if (multi) outStr += '\n';
      if (!multi) outStr += JSON.stringify(lines, null, 2);
      continue;
    }
    if (multi || opts.alwaysLabel) outStr += `=== ${r.item.label} ===\n`;
    if (manual) outStr += manualNote;
    const rawText = opts.code ? r.data.text : cleanCjk(r.data.text);
    outStr += rawText.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  if (opts.json && !multi) {
    // 单文件 json 已是 lines 数组
  } else if (opts.json && multi) {
    outStr = outStr.trim();
  }

  if (opts.csv && outStr && !outStr.startsWith('\uFEFF')) outStr = '\uFEFF' + outStr;
  if (!opts.noCache) writeCache(cacheKey(opts._, opts), { out: outStr, warnings });
  if (warnings.length) console.error('warn: ' + warnings.join('；'));
  const totalMs = ((Date.now() - t0) / 1000).toFixed(2);
  if (!opts.quiet) console.error(opts.uiLang === 'en' ? `summary: ${items.length} file(s), review ${warnings.length}, ${totalMs}s` : `summary: ${items.length} 张，需核对 ${warnings.length} 份，耗时 ${totalMs}s`);
  if (opts.out) {
    fs.writeFileSync(opts.out, outStr);
    process.stdout.write(opts.uiLang === 'en' ? `OCR result written to: ${opts.out}\n` : `OCR 结果已写入: ${opts.out}\n`);
  } else {
    process.stdout.write(outStr);
  }
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
