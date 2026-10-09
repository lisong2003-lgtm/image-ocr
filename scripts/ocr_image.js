#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const MODELS = path.join(__dirname, '..', 'assets', 'tessdata');
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

function usage() {
  console.log(`用法:
  ocr_image <图片或PDF路径> [更多文件...] [选项]

选项:
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
  --no-auto-download   关闭自动下载`);
}

function parseArgs(argv) {
  const opts = { _: [], lang: 'chi_sim', psm: 'auto', whitelist: null, preprocess: true, deskew: false, binarize: false, upscale: false, json: false, table: false, csv: false, out: null, autoRetry: true, autoRotate: false, page: null, maxPages: null, dpi: 200, autoLang: true, code: false, langList: false, downloadLangs: null, autoDownload: true, langExplicit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') { opts.lang = argv[++i]; opts.langExplicit = true; }
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
    else if (a.startsWith('-')) { usage(); process.exit(1); }
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
const CACHE_TTL_MS = 5 * 60 * 1000;
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
  payload += '\0' + JSON.stringify({ lang: opts.lang, psm: opts.psm, whitelist: opts.whitelist, preprocess: opts.preprocess, deskew: opts.deskew, binarize: opts.binarize, upscale: opts.upscale, json: opts.json, table: opts.table, csv: opts.csv, autoRetry: opts.autoRetry, autoRotate: opts.autoRotate, page: opts.page, maxPages: opts.maxPages, dpi: opts.dpi, autoLang: opts.autoLang, code: opts.code, autoDownload: opts.autoDownload });
  return sha256(Buffer.from(payload));
}

function readCache(key) {
  if (!OCR_CACHE) return null;
  try {
    const f = path.join(OCR_CACHE, key + '.json');
    if (!fs.existsSync(f)) return null;
    const st = fs.statSync(f);
    if (Date.now() - st.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) { return null; }
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
  const r2 = spawnSync('sips', ['-s', 'format', 'png', pdf, '--out', out], { encoding: 'utf8' });
  if (r2.status === 0 && fs.existsSync(out)) {
    console.error('warn: 仅能转第 1 页（未找到 pdftoppm，--page/--max-pages 不生效）');
    return [out];
  }
  console.error(`[转换失败] PDF 转换失败: ${pdf}（可安装 poppler 提供 pdftoppm 后重试）`);
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
  const s = words.map((w) => w.text).join(' ');
  return cleanCjk(s).trim();
}

function csvEscape(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function buildTable(results, fmt) {
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
      const gapTh = Math.max(6, medianW * 0.7);
      for (let i = 1; i < ws.length; i++) {
        if (ws[i].x0 - ws[i - 1].x1 > gapTh) { cells.push(joinWords(cur)); cur = [ws[i]]; }
        else cur.push(ws[i]);
      }
      cells.push(joinWords(cur));
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

function ensureModel(lang) {
  if (fs.existsSync(path.join(MODELS, `${lang}.traineddata`))) return true;
  if (!AUTO_DOWNLOAD) return false;
  const dl = path.join(__dirname, 'download_langs.sh');
  const r = spawnSync('bash', [dl, lang], { encoding: 'utf8' });
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  AUTO_DOWNLOAD = opts.autoDownload;
  const t0 = Date.now();
  if (opts.langList) {
    const langs = listModels();
    console.log('已安装语言模型: ' + (langs.length ? langs.join(', ') : '无'));
    process.exit(0);
  }
  if (opts.downloadLangs) {
    const dl = path.join(__dirname, 'download_langs.sh');
    const r = spawnSync('bash', [dl, opts.downloadLangs], { encoding: 'utf8', stdio: 'inherit' });
    process.exit(r.status || 0);
  }
  if (!opts._.length) { usage(); process.exit(1); }

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

  const cache = readCache(cacheKey(opts._, opts));
  if (cache) {
    if (cache.warnings && cache.warnings.length) console.error('warn: ' + cache.warnings.join('；'));
    if (cache.out) {
      if (opts.out) {
        fs.writeFileSync(opts.out, cache.out);
        process.stdout.write(`OCR 结果已写入: ${opts.out}\n`);
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

  const baseFlags = { binarize: opts.binarize, deskew: opts.deskew, upscale: opts.upscale, rotate: 0 };
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
      if (best.flags && best.flags.rotate) console.error(`warn: ${item.label} 使用了旋转 ${best.flags.rotate}° 结果`);
      if (bestWindowKey(best, bestWorker, opts)) console.error(`warn: ${item.label} 自动切换为 eng 识别`);
      results.push(best);
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
    if (low.length) {
      const details = low.slice(0, 3).map((l, i) => {
        const idx = lines.indexOf(l) + 1;
        return `行${idx} "${String(l.text).slice(0, 30)}" conf=${Math.round(l.conf)}`;
      }).join('；');
      warnings.push(`${r.item.label}: ${low.length} 行置信度<${LOW_CONF}（${details}）`);
    }
    if (opts.table || opts.csv) {
      if (multi) outStr += `=== ${r.item.label} ===\n`;
      outStr += buildTable([r], opts.csv ? 'csv' : 'md') + '\n';
      continue;
    }
    if (opts.json) {
      const converted = { image: r.item.label, lines: lines };
      outStr += (multi ? JSON.stringify(converted) : '') ;
      if (multi) outStr += '\n';
      if (!multi) outStr += JSON.stringify(lines, null, 2);
      continue;
    }
    if (multi) outStr += `=== ${r.item.label} ===\n`;
    const rawText = opts.code ? r.data.text : cleanCjk(r.data.text);
    outStr += rawText.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  if (opts.json && !multi) {
    // 单文件 json 已是 lines 数组
  } else if (opts.json && multi) {
    outStr = outStr.trim();
  }

  if (opts.csv && outStr && !outStr.startsWith('\uFEFF')) outStr = '\uFEFF' + outStr;
  writeCache(cacheKey(opts._, opts), { out: outStr, warnings });
  if (warnings.length) console.error('warn: ' + warnings.join('；'));
  const totalMs = ((Date.now() - t0) / 1000).toFixed(2);
  console.error(`summary: ${items.length} 张，需核对 ${warnings.length} 份，耗时 ${totalMs}s`);
  if (opts.out) {
    fs.writeFileSync(opts.out, outStr);
    process.stdout.write(`OCR 结果已写入: ${opts.out}\n`);
  } else {
    process.stdout.write(outStr);
  }
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
