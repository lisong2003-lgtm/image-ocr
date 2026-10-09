# Third-Party Notice

## Language models (`assets/tessdata/`)

- `chi_sim.traineddata` / `eng.traineddata` — `4.0.0_best_int` LSTM models from tesseract.js maintainers' `@tesseract.js-data` packages.
  - https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz
  - https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz
- `jpn.traineddata` — downloaded from `tessdata_fast` (https://github.com/tesseract-ocr/tessdata_fast).

SHA-256 (verified after gunzip where applicable):

- chi_sim.traineddata 2471033 bytes `9784f7c917c546424b690fcde708ce1f604a4393d08bb51ddab146d7d7c794e6`
- eng.traineddata 5199098 bytes `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`
- jpn.traineddata 2471260 bytes `1f5de9236d2e85f5fdf4b3c500f2d4926f8d9449f28f5394472d9e8d83b91b4d`

The npm packages declare MIT; the models derive from official Tesseract `tessdata_best`/`tessdata_fast`
repositories (see upstream licenses for redistribution). Bundling here only provides offline operation;
they are not relicensed by this package. The SkillHub build excludes binaries; its README documents the
equivalent one-time download commands.

## Runtime dependencies (not bundled)

- `tesseract.js` 7 — Apache License 2.0, https://github.com/naptha/tesseract.js (via `npm install`)
- Pillow — MIT-CMU license, https://github.com/python-pillow/Pillow (via `pip install`)
- poppler `pdftoppm` — GPL-2.0-or-later, optional, only for multi-page PDF rendering
