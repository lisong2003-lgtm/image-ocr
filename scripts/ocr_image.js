#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

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
  --json               输出带坐标的逐行结果`);
}

function parseArgs(argv) {
  const opts = { _: [], lang: 'chi_sim', psm: 'auto', whitelist: null, preprocess: true, deskew: false, binarize: false, upscale: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--psm') opts.psm = argv[++i];
    else if (a === '--whitelist') opts.whitelist = argv[++i];
    else if (a === '--preprocess') opts.preprocess = true;
    else if (a === '--no-preprocess') opts.preprocess = false;
    else if (a === '--upscale') opts.upscale = true;
    else if (a === '--deskew') { opts.deskew = true; opts.preprocess = true; }
    else if (a === '--binarize') { opts.binarize = true; opts.preprocess = true; }
    else if (a === '--json') opts.json = true;
    else if (a.startsWith('-')) { usage(); process.exit(1); }
    else opts._.push(a);
  }
  // 这三项依赖预处理管线，与 --no-preprocess 的先后顺序无关
  if (opts.deskew || opts.binarize || opts.upscale) opts.preprocess = true;
  return opts;
}

function cleanCjk(text) {
  // 去掉 tesseract 在相邻中日韩字符/标点之间插入的空格
  const re = new RegExp(`(${CJK})[ \\t]+(?=${CJK})`, 'g');
  let prev;
  do { prev = text; text = text.replace(re, '$1'); } while (text !== prev);
  return text;
}

let seq = 0;
function preprocess(src) {
  fs.mkdirSync(TMP, { recursive: true });
  const out = path.join(TMP, `pre_${++seq}.png`);
  const args = [path.join(__dirname, 'preprocess.py'), src, out];
  if (opts_binarize) args.push('--binarize');
  if (opts_deskew) args.push('--deskew');
  if (opts_upscale) args.push('--upscale');
  const r = spawnSync(findPython(), args, { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) {
    if (r.stderr) console.error(r.stderr.trim());
    return src;
  }
  return out;
}

let opts_binarize = false, opts_deskew = false, opts_upscale = false;

function renderPdf(pdf) {
  fs.mkdirSync(TMP, { recursive: true });
  const bin = findBinary('pdftoppm');
  if (bin) {
    const prefix = path.join(TMP, `pdf${++seq}`);
    const r = spawnSync(bin, ['-png', '-r', '200', pdf, prefix], { encoding: 'utf8' });
    if (r.status === 0) {
      const base = path.basename(prefix);
      const pages = fs.readdirSync(TMP).filter((f) => f.startsWith(base) && f.endsWith('.png')).sort();
      if (pages.length) return pages.map((f) => path.join(TMP, f));
    }
  }
  const out = path.join(TMP, `pdf1p_${++seq}.png`);
  const r2 = spawnSync('sips', ['-s', 'format', 'png', pdf, '--out', out], { encoding: 'utf8' });
  if (r2.status === 0 && fs.existsSync(out)) {
    console.error('warn: 仅识别第 1 页（未找到 pdftoppm，无法转全部页）');
    return [out];
  }
  console.error(`PDF 转换失败: ${pdf}`);
  return [];
}

function extractItems(paths) {
  const items = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) { console.error(`文件不存在: ${p}`); continue; }
    if (p.toLowerCase().endsWith('.pdf')) {
      renderPdf(p).forEach((f, i) => items.push({ image: f, label: `${p} [第${i + 1}页]` }));
    } else {
      items.push({ image: p, label: p });
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
        lines.push({ text: line.text.trim(), conf: line.confidence, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      }
    }
  }
  lines.sort((a, b) => (Math.abs(a.y0 - b.y0) > 12 ? a.y0 - b.y0 : a.x0 - b.x0));
  return lines;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts_binarize = opts.binarize;
  opts_deskew = opts.deskew;
  opts_upscale = opts.upscale;
  if (!opts._.length) { usage(); process.exit(1); }

  const modelFile = path.join(MODELS, `${opts.lang}.traineddata`);
  if (!fs.existsSync(modelFile)) {
    console.error(`缺少语言模型: ${modelFile}`);
    console.error('可用模型: chi_sim, eng');
    process.exit(1);
  }

  const tessPath = findTesseract();
  if (!tessPath) {
    console.error('找不到 tesseract.js，请检查 Codex 运行时缓存');
    process.exit(1);
  }
  const { createWorker, OEM, PSM } = require(tessPath);

  const items = extractItems(opts._);
  if (!items.length) process.exit(1);
  const multi = items.length > 1;

  // 单个 worker 处理全部输入，省掉每张图 2-5 秒的模型加载
  const worker = await createWorker(opts.lang, OEM.LSTM_ONLY, {
    langPath: MODELS,
    gzip: false,
    cachePath: path.join(os.tmpdir(), 'tesscache-reuse'),
    cacheMethod: 'none',
    logger: () => {},
    debug: () => {}
  });

  const params = { tessedit_pageseg_mode: PSM[PSM_NAMES[opts.psm]] };
  if (opts.whitelist) params.tessedit_char_whitelist = opts.whitelist;
  await worker.setParameters(params);

  const results = [];
  try {
    for (const item of items) {
      let target = item.image;
      let pre = null;
      if (opts.preprocess) {
        target = preprocess(item.image);
        if (target !== item.image) pre = target;
      }
      const ret = await worker.recognize(target, { rotateAuto: true }, { blocks: true });
      results.push({ item, data: ret.data, pre });
    }
  } finally {
    await worker.terminate();
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  if (opts.json) {
    const out = results.map((r) => ({ image: r.item.label, lines: lineResults(r.data) }));
    console.log(JSON.stringify(multi ? out : out[0].lines, null, 2));
  } else {
    for (const r of results) {
      if (multi) console.log(`=== ${r.item.label} ===`);
      process.stdout.write(cleanCjk(r.data.text).replace(/\n{3,}/g, '\n\n').trim() + '\n');
    }
  }
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
