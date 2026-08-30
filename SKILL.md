---
name: image-ocr
slug: image-ocr
displayName: 图片文字识别 / Image OCR
version: 0.1.1
author: lis
license: CC-BY-NC-SA-4.0
description: Read text, numbers, and math expressions from image files using local OCR (chi_sim/eng), fully offline. Use whenever the user attaches an image or a scanned/multi-page PDF and asks what it says, wants content extracted, needs a worksheet or questions read from a photo, or wants image text converted to editable text. Accepts several images or PDFs in one call. Also use to preprocess low-quality images before OCR. Provides text extraction only, not scene understanding.
---

# Image OCR（图片文字识别）

Local OCR only: image bytes never leave the machine. No cloud vision API, no upload.
Text extraction only — this skill does not describe scenes, interpret charts visually, or answer questions about an image's content beyond its pixels.

## Requirements

- Node.js with `tesseract.js` 7 installed once: `cd <skill>/scripts && npm install tesseract.js@7`
- Python 3 + Pillow for preprocessing: `python3 -m pip install Pillow`
- Optional: `pdftoppm` (poppler) for multi-page PDF; `sips` (macOS) handles page 1 only
- Language models ship in `assets/tessdata/` (chi_sim, eng), so no runtime download

## Quick start

One command, any number of images or PDFs:

`node <skill>/scripts/ocr_image.js <图片路径> [更多图片/scan.pdf ...]`

stdout carries recognized text only. Add a PATH link to filter engine progress noise:

`chmod +x <skill>/scripts/ocr_image.sh && ln -s "$(cd <skill>/scripts && pwd)/ocr_image.sh" ~/.local/bin/ocr_image`

PDFs render at 200 DPI via pdftoppm (all pages); without pdftoppm, `sips` falls back to page 1 only. One worker loads once and reuses across all inputs.

## Options

- `--lang chi_sim|eng` — default `chi_sim` (handles Chinese and digits). Do NOT pass `chi_sim+eng`; multi-language init fails in tesseract.js 7.
- `--psm auto|sparse|block|line` — page segmentation mode.
- `--whitelist "0123456789+-x×÷=()"` — restrict characters, useful for math and numbers.
- preprocessing is ON by default: grayscale + autocontrast, plus 2x upscale only when the image is <=800px. Do not add a flag for it.
- `--no-preprocess` — recognize raw pixels. `--upscale` — force 2x (measured to *hurt* clean large screenshots, so leave it off unless text is tiny).
- `--deskew` — skew correction ±5°, for photos taken at an angle.
- `--binarize` — Otsu binarization, for low-contrast scans.
- `--json` — line-level results with boxes; with `--deskew`/`--upscale` the boxes are in preprocessed-image space, not the original file.

## Workflow

1. Run with defaults first. Only if output is poor: retry `--psm sparse`, then `--deskew` or `--binarize`, then `--upscale`.
2. Chinese text plus numbers: default `chi_sim` (CJK inter-character spaces are stripped in text mode; `--json` keeps raw text).
3. Pure English or numbers: `--lang eng`.
4. Several images or PDFs in one call is cheaper than repeated calls — the model loads once.
5. Handwriting, blurry photos, and low-resolution scans are unreliable. Tell the user what OCR could and could not read; do not invent unreadable content.
6. Confidential or internal documents stay on this local engine by default; do not route them to a cloud vision service without the user's explicit consent.

## Resources

- `scripts/ocr_image.js` — OCR command line tool
- `scripts/ocr_image.sh` — launcher (auto-detects node/python, filters progress noise)
- `scripts/preprocess.py` — preprocessing (grayscale, autocontrast, conditional upscale, deskew, Otsu)
- `assets/tessdata/` — chi_sim and eng traineddata models (tesseract.js `4.0.0_best_int` copies; provenance and licenses in NOTICE.md)
