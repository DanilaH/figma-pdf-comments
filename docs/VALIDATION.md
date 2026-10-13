# Validation record — 2026-10-13

## Performed

- TypeScript strict check: PASS.
- Unit/PDF tests: 10 PASS.
- Build: PASS; all dependencies/font are bundled locally.
- Synthetic PDF: 8 pages rendered with PyMuPDF and visually inspected; all end markers, reply/outside text and `[U+1F600]` retained. Five link annotations read back from the PDF.
- Built UI in actual Chromium against an explicit mocked host/API: 7 scenarios PASS, 3 intercepted API requests, 0 page JavaScript errors. Actual PDF and JSON downloads checked; token absent from JSON.
- Safety by implementation: no `clientStorage`, `localStorage`, backend calls or logging of PAT. REST destination is built from a validated Figma file key; redirects are refused.

## Not performed

- Import of the manifest into Figma or assignment of a real development plugin ID.
- Live GET comments/PAT permissions/CORS or Plugin API screenshot exports.
- Live source-file identity validation: public fileKey is unavailable; manual confirmation required.
- Proof of absolute raster origin, regions and pin corners in live exports.
- CopyDoc comparison or measured human time savings.
- Real attachments round trip (excluded by design).
- Paid demand, catalogue acquisition, moderation, billing, security audit or production readiness.

## Defects caught during local verification

1. Double subsetting DejaVu with fontkit generated a PDF with valid extractable text but missing rendered glyphs. Fixed: embed the already-subsetted TTF intact. Re-rendered all pages.
2. Inserting a minified bundle via a string replacement interpreted `$` replacement patterns inside third-party code. Fixed: callback replacement, then actual browser test.
3. Cancelled frame responses could race with a later export. Added request IDs on both sides and rejected stale responses. The cancellation/denial scenario is tested. Actual Figma native export itself cannot be interrupted; UI discards its cancelled result.

## Stop conditions

Incorrect mapping, silent message loss or an unverified wrong-file association blocks release. A comparable configured free/manual result blocks product development. Even a technically correct prototype is not evidence that buyers will pay.
