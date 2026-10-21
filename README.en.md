# Local Offline OCR

> image-ocr (image-ocr) v0.3.3 · overseas-friendly lightweight layer. 中文版见 [README.md](README.md).

## What it is
Extracts text, numbers, tables, code and formulas from images, screenshots, scans and multipage PDFs locally. Supports Simplified Chinese (chi_sim), English (eng) and other downloaded language packs. It can output plain text, Markdown tables, CSV, or per-line JSON with coordinates and confidence.

## When to use it
Use when you receive an image/PDF and need its text, table, or code without sending the bytes to the cloud.

## Quick start
```bash
ocr_image <image-or-pdf> [more files...]
ocr_image --table --csv result.csv image.png
ocr_image --json image.png
```

## Install across the three platforms
- **GitHub**: clone or download the repo, copy the skill folder into `$CODEX_HOME/skills/` (or `~/.claude/skills/` / your agent's skill directory).
- **SkillHub**: install the SkillHub lightweight package (text-only). The lightweight package removes platform-only launcher files (`.cmd`/`.ps1`, extensionless scripts and binary language models) and documents the Windows usage inside its own README; the GitHub full package keeps all platform launchers and assets.
- **ClawHub**: install the ClawHub full package, which keeps cross-platform launchers and assets.
- All platform packages serve the same canonical logic; platform copies never change the canonical code.

## Dependencies
Node.js + tesseract.js; python3 (with Pillow) for preprocessing; PDF rendering uses pdftoppm/poppler on macOS/Linux or bundled Windows path. setup.sh / setup.ps1 installs what is missing.

## Privacy
Fully local; images are never uploaded and model downloads are separate and explicit.

## Boundaries / limitations
Best for machine-printed text and clear tables. Handwriting-heavy or severely degraded scans may produce low-confidence results and must be manually reviewed.

## License
CC-BY-NC-SA-4.0

---

## Culture note
- `--lang en|zh` controls UI/help/JSON message language (default `zh`); business algorithms are identical in both languages.
- For image-ocr, `--lang` remains the OCR language; UI language is `--ui-lang en|zh`.
- Local Chinese templates and plant/concept dictionaries are NOT replaced; overseas inputs can select alternatives via parameters (e.g. `--plant-library`, `--project-rules`) so existing Chinese users are unaffected.
- Review flags, confidence tiers and evidence coordinates are language-independent fields.
