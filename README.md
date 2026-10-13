# Figma PDF Comments — diagnostic prototype

Builds a local PDF from selected Figma Design screens and the current text comment threads. This is a bounded experiment, not a commercial release. File Packs for Forminator remains the primary project; Lava is not integrated here.

**Status: source, built UI, unit tests, PDF rendering and a browser mock test are verified locally. Installation and execution inside real Figma, actual coordinate responses, permissions/CORS and comparison with CopyDoc are NOT verified.** The mock host is explicitly labelled and cannot prove Figma integration.

## What it does

- Reads comments using the official REST endpoint and a `file_comments:read` PAT.
- Exports 1–12 selected top-level frames using the Plugin API.
- Builds one PDF with a contents list, current screen images, report-numbered pins/regions, authors, original timestamps, replies, resolved/open status and file/screen links.
- Splits long screen images and discussions across pages rather than truncating them.
- Preserves outside, deleted/excluded-anchor, ambiguous and orphan messages in an unassigned section with a reason.
- Lets the user download local diagnostics JSON with original text and coordinate evidence, but never the token.

## Explicit limitations

Comment image/GIF attachments are **excluded**. The official schema inspected on 2026-10-12 does not expose them. An image-only comment may lose its meaning and cannot reliably be detected from that schema. This is not a complete archive, a history export or proof of approval.

The public Plugin API does not expose `figma.fileKey`. You must paste the URL of the open file and confirm it matches. The plugin cannot independently prove that identity; a wrong file with coinciding node IDs could misassign comments. It therefore remains diagnostic. Do not export client material until the identity and mapping are independently checked.

Only visible frames directly on the current page are supported. Clip content must be enabled. Rotated/flipped/transformed frames and effects on the frame container are rejected. Child layer effects are allowed. Group/component selections, FigJam, branches and version history are excluded. Limits: 12 frames, 20 million pixels per frame, frame height 20,000, 2,000 messages, 250 PDF pages. These are diagnostic bounds, not inferred Figma limits.

The PNG geometry check rejects an aspect-ratio mismatch. It cannot by itself prove correct pixel origin: that remains a live Figma gate. REST comments and frame images are captured sequentially, not atomically. Avoid editing/moving frames while exporting.

The embedded DejaVu Sans subset supports Latin, Cyrillic, Greek and many symbols. Unsupported glyphs are explicitly printed as `[U+…]` and listed in the PDF; exact text remains in diagnostics JSON. Full multilingual shaping, emoji graphics and rich Markdown rendering are not implemented. Markdown remains readable literal text.

No licence backend, payments, AI, telemetry, persistent token storage, DOM scraping or browser extension. Closing the plugin destroys its token input/memory. Requests go only to `api.figma.com`. Exported PDFs/JSON contain design/comment data and should be handled accordingly.

## Build

Verified with Node 24.19.0; use Node 22 or newer.

```sh
npm ci
npm run verify
```

`dist/code.js`, `dist/ui.html` and third-party notices are also checked in for the diagnostic branch so the downloaded source ZIP contains a ready build. Rebuild after any source change. Exact dependency versions and integrity are in `package-lock.json`. No product licence has been chosen; public source visibility is not an extra licence grant. Third-party licences are in `THIRD_PARTY_NOTICES.md` and `dist/THIRD_PARTY_NOTICES.txt`.

## Load into Figma

Use the Figma desktop application on Windows/macOS. Import `manifest.json` through Plugins → Development → Import plugin from manifest. The manifest deliberately contains no invented plugin ID.

If Figma requires an ID, create a new development plugin in your own account, copy its Figma-assigned `id` from the generated manifest, then run:

```sh
node configure.mjs YOUR_FIGMA_ASSIGNED_ID
```

Import this project's manifest again. Import/ID behaviour has not been exercised in this environment. Do not use someone else's ID and do not publish the diagnostic build to Community.

1. Open a disposable Figma Design file and select top-level frames on one page.
2. Run Review Pack Diagnostic.
3. Paste the main file URL and a short-lived read-only PAT with `file_comments:read`.
4. Confirm that the URL is for the open file and that attachments are excluded.
5. Create the diagnostic PDF, then download PDF and JSON.
6. Check pin/region placement against the actual Figma UI and every source thread. Compare message counts, not just PDF appearance.

Do not send your token in chat, attach it to issues, commit it, or put it in diagnostics.

## Tests and evidence

`npm run verify`: TypeScript, 10 unit/PDF tests, build. Tests cover URL/token destination validation, all four region corners, ambiguous/outside/missing anchors, replies/orphans/cycles, malformed or duplicate API data, 403/404/429/500, long-screen splitting, long comments, Unicode fallback and raster mismatch.

PDF fixture is synthetic and labelled `SYNTHETIC DIAGNOSTIC — not live Figma`. Local output: 8 pages; all four source messages preserved, one unassigned thread, one explicit emoji fallback, 5 file/screen/contents links. All pages were rendered and visually reviewed. PDF text extraction alone missed a font-rendering defect, which was fixed by embedding the already-subsetted TTF without a second fontkit subset.

Optional browser test:

```sh
npx playwright install chromium-headless-shell
npm run build
node test/browser-smoke.cjs
```

For an existing compatible binary: `CHROME_PATH=/absolute/path/to/chrome-headless-shell node test/browser-smoke.cjs`. The browser test runs its own local HTTP server in the same process. On this sandbox it used Chrome Headless Shell 151.0.7922.34, `--single-process --no-zygote`, and mock API routes. Seven scenarios passed: consent, successful counts, PDF download, token absent from JSON, cancel, denied access after cancelled capture, URL change invalidates confirmation. Zero page JS errors. This does not test Figma itself.

`test-output/` is intentionally not committed: it is reproducible and may contain future private test data. Sanitized results are in `docs/VALIDATION.md`.

## Decision gate

On 2026-10-13 the user provided an actual HTML export from Comments & Version History Exporter: four root comments and one reply, with authors/dates. That HTML had no screen images, coordinates, pin IDs or source-position links. Its unchanged HTML print produced a readable single-page text document. This proves a gap in that sample, not in every competitor or setting. No private source exports, screenshots, file keys or comment bodies are committed here.

Next: run this build on the same real file, verify mapping and completeness, then compare with CopyDoc and a configured manual document workflow. Time first-run setup separately from repeat exports. Check resolved comments, replies, regions, outside comments, a moved frame and attachments. If the free/manual process is comparable, or the report without attachments is not useful, stop. Do not add features to rescue the idea. There is no sales or willingness-to-pay evidence yet.
