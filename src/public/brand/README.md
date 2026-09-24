# Jev Arena / NeuroGabo brand v2

The public arena follows the NeuroGabo **v2.0 brand book, 23 September 2026**:
Plus Jakarta Sans, charcoal `#2A2D36`, ivory `#FEFDF7`, orange `#FE6202`, and sand
`#F0E6D8`. Orange is a graphic accent; small text and focus rings use charcoal.
Headings use weight 600, labels 500, paragraphs 400, and occasional emphasis 700.
The product name remains Jev Arena; it does not recreate the NeuroGabo logo.

`../public.css` embeds the regular and italic variable fonts as WOFF2 data URLs,
so both the lobby and battle iframe work without a third-party font request or
a separate asset route. The battle's compact header and viewport sizing remain
independent of the branding. This presentation change leaves the decision engine
and its results version unchanged.

## Font source and license

The original files were copied from the approved brand kit's `brand/v2/fonts/`.
Their SHA-256 hashes match its manifest:

- `PlusJakartaSans[wght].ttf`:
  `89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8`
- `PlusJakartaSans-Italic[wght].ttf`:
  `9529eb888668b6a3c6dd75b6341a2fc5263fb6c9e788822e6117c29dd9e8b115`

Upstream: [Plus Jakarta Sans](https://github.com/google/fonts/tree/main/ofl/plusjakartasans).
Copyright 2020 The Plus Jakarta Sans Project Authors.
Redistributed under [SIL Open Font License 1.1](OFL.txt).

The format-only conversion uses Python FontTools with Brotli:
`font = TTFont(source); font.flavor = 'woff2'; font.save(output)`.
No glyph subsetting, renaming or changes to the design or variable weight axis
were made. Each resulting file is base64-encoded in the corresponding `@font-face`
at the end of `public.css`. Only rebuild those blocks when the approved fonts change.
