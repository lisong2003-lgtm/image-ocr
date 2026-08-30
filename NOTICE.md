# Third-Party Notice

## Language models (`assets/tessdata/`)

Bundled files are the `4.0.0_best_int` LSTM traineddata published by the tesseract.js
maintainers as the npm packages `@tesseract.js-data/chi_sim` and `@tesseract.js-data/eng`
(https://github.com/naptha/tessdata), retrieved as:

- https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz
- https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz

Verified identical after `gunzip` by SHA-256:

- chi_sim.traineddata 2471033 bytes `9784f7c917c546424b690fcde708ce1f604a4393d08bb51ddab146d7d7c794e6`
- eng.traineddata 5199098 bytes `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`

The npm packages declare MIT; the models themselves are derived from the official
Tesseract `tessdata_best` models (https://github.com/tesseract-ocr/tessdata_best), so
check the upstream license for your own redistribution. Bundling them here only makes
the skill work offline — they are not relicensed by this package.

The SkillHub build does not bundle binaries (the platform rejects them); `SKILL.md` and
`README.md` document the equivalent one-time download commands above.

## Runtime dependencies (not bundled)

- `tesseract.js` 7 — Apache License 2.0, https://github.com/naptha/tesseract.js (installed by `npm install`)
- Pillow — MIT-CMU license, https://github.com/python-pillow/Pillow (installed by `pip install`)
- poppler `pdftoppm` — GPL-2.0-or-later, optional, only for multi-page PDF rendering
