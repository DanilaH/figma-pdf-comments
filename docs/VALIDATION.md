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

## User-run result, CopyDoc comparison and compact layout — 2026-10-13

The user returned a real Figma-generated PDF and diagnostics: four selected frames, four root threads and five total messages. All five texts were present. Two threads matched selected frame IDs and local coordinates; the two other root anchors were outside the selection and retained unassigned. The original output had sixteen pages. No resolved thread or region was included, so live coverage of those cases remains open. The developer inspected outputs and did not operate the user's Figma account.

The user's real CopyDoc ZIP retained the same five messages, authors, timestamps and statuses, plus source comment links and three numbered frame PNGs. It exported only frames with comments; two comment-free frames selected in our run were absent, while its UI-kit frame was absent from our selection. These differences are scope differences, not lost comments or automatic superiority. The Pro-use counter does not prove the comments feature is paid.

For the new layout, the four original rasters were reconstructed from image objects embedded in the user's PDF, including the cards transparency mask. Original geometry, messages, IDs and snapshot timestamp were unchanged. This is offline regeneration from actual exported data, not a new live Figma run.

Result: 9 pages instead of 16, five messages each exactly once, no standalone empty discussion pages. Both 852-pixel ordinary screens fit one page; the 3197-pixel screen retains readable width and spans four parts. Short threads appear on the same page as their pins. Duplicate screen names are prefixed by their selection index; contents links target the corresponding start page.

On the common two-screen selection, retaining all five messages and keeping excluded anchors in an unassigned section, our regenerated report and an automated CopyDoc PNG/JSON assembly each had seven pages. This is not evidence of equal human time: human timing was not performed, and the CopyDoc report was assembled programmatically.

Strict TypeScript, all 11 unit/PDF tests and eight Chromium mock scenarios passed. Rendered PDFs were visually reviewed, including long-comment continuation. The `file`/`confirmed` extraction regression is also checked after disabling optional ligatures. No new billing, API scope, history feature or parser support was added.

## First user run and bridge fix — 2026-10-13

The user installed the development plugin and reached `Exporting selected frames…`, followed by the 60-second frame-response timeout. The preceding REST read therefore completed in that run. Successful native screenshot export and PDF creation are still unconfirmed.

The UI assumed `event.source === parent`, which the official Figma bridge contract does not promise. This could discard native progress/error/snapshot messages; it is a candidate explanation, not a proven diagnosis of the user's exact event. Removed that assumption and bound replies to a random per-session nonce plus sequence ID and a pending request instead. No credentials are transmitted over the UI bridge.

Added an immediate native acknowledgment, per-frame render progress, a 15-second no-ack timeout and a 60-second per-stage timeout with the last stage in the error. This distinguishes a broken communication channel from an expensive native render.

Image byte arrays are recreated in the UI realm before passing to pdf-lib. The bridge regression also caught a cross-realm Uint8Array prototype mismatch; normalization fixes it without changing the image bytes.

Regression: actual Chromium UI received mock bridged messages with `source:null`; success, progress, PDF download, cancellation and stale-request handling passed. Eight browser scenarios, zero page JavaScript errors. TypeScript and all 10 unit/PDF tests passed again. The actual Figma rerun remains required.
