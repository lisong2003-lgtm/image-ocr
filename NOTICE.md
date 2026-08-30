# Third-Party Notice

## Tesseract language models

`assets/tessdata/chi_sim.traineddata` and `assets/tessdata/eng.traineddata` are
Bundled copies of the LSTM Tesseract language models used by this skill. They come from
the tesseract.js language-data mirror https://tessdata.projectnaptha.com/4.0.0, which
distributes the official `tessdata_fast` models (upstream project:
https://github.com/tesseract-ocr/tessdata_fast), licensed under the Apache License 2.0.

Bundled file sizes (not byte-identical to any single upstream tag; treat as the
tesseract.js 4.0.0 distribution):
- chi_sim.traineddata 2471033 bytes
- eng.traineddata 5199098 bytes

The SkillHub build does not bundle these binaries (the platform rejects binary files);
that build documents one-time `curl -LO` commands for the tagged upstream files
`tessdata_fast` 4.1.0, verified to work with this skill.

- Copyright: the respective authors of the tessdata project
- License: https://www.apache.org/licenses/LICENSE-2.0
- Bundled so the skill runs fully offline with no runtime download

## tesseract.js

`tesseract.js` is a runtime dependency installed by the user via npm and is **not**
bundled in this package. It is licensed under the Apache License 2.0
(https://github.com/naptha/tesseract.js).

## Pillow

`preprocess.py` uses Pillow (MIT-CMU licensed), installed by the user via pip and not
bundled in this package.
