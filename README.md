# SecureKit

**Privacy-first PDF toolkit. Six tools. Zero uploads.**

Everything runs in your browser — files never leave your device, even when offline.

Live site: open `index.html` locally, or host the folder on any static web host (GitHub Pages, Netlify, S3, your own server).

---

## Tools

| Tool | What it does |
| --- | --- |
| **Merge** | Combine multiple PDFs into one, with optional page selection and reordering by drag or keyboard |
| **Split** | Extract pages, split by ranges, or split every N pages |
| **Compress** | Smart JPEG image recompression (preserves text, vectors, forms, links), with optional destructive page-flatten fallback |
| **Secure** | Protect PDFs with AES-256 encryption, an optional separate owner password, and reader-enforced permissions (printing, copying, editing, annotating, forms, page assembly, accessibility) |
| **PDF to Image** | Render PDF pages to JPG or PNG at configurable quality and scale |
| **Image to PDF** | Combine JPG and PNG images into a single PDF with configurable page size and margins |

---

## Privacy guarantees

- **No uploads.** No backend, no servers. Open DevTools → Network and you'll see zero requests during processing.
- **No third-party CDNs at runtime.** All dependencies (`pdf-lib`, `pdf.js`, `JSZip`) are vendored locally under `lib/`, and encryption uses the browser's own Web Crypto API. The site can run completely air-gapped.
- **Locked-down CSP.** Every page declares `script-src 'self'` — even if a future change accidentally tried to load remote code, the browser would block it.
- **Not embeddable.** SecureKit refuses to run inside someone else's frame, so the tools (the password fields especially) cannot be wrapped in a clickjacking overlay.
- **Service-worker-backed offline mode.** After your first visit, the entire app works without an internet connection.
- **Installable.** SecureKit is a PWA, so it can be installed to a desktop or home screen and launched in its own window — still with no backend and no network access required.
- **Nothing lingers.** Sending a merged file straight to the Compress tool is a page navigation, so the file is parked in IndexedDB for the hop. It is deleted the moment the receiving tool picks it up, and any handoff left behind by an abandoned transfer is purged after 30 minutes.

---

## Accessibility

- Every page starts with a skip link, names its `main`/`nav` landmarks, and
  marks the current tool with `aria-current`.
- Everything is reachable by keyboard. File lists can be reordered with Move
  up / Move down buttons, so arranging pages never requires dragging.
- Workflow changes (processing, finished, cancelled) move focus to the heading
  of the section that appeared, and progress is announced through a live region.
- Decorative icons are hidden from assistive technology; every control has an
  accessible name.

---

## Memory limits

Everything runs in the page, so a batch that is too large crashes the tab rather
than failing politely. Each tool estimates its peak before accepting files and
refuses work it cannot finish, against a shared 1 GB ceiling in
`shared-utils.js`.

The estimates differ because the costs do:

| Tool | What dominates |
| --- | --- |
| Image to PDF | Pixels, for PNG only. pdf-lib embeds a JPEG's compressed stream untouched, but decodes a PNG to raw RGBA - a 0.17 MB 3000x3000 PNG measured ~103 MB of heap. Dimensions are read from the file header, without decoding. |
| Secure | The batch total, since every encrypted result is held until the end, plus roughly 4x the largest single file while it is being encrypted. |
| Compress / Merge | File size, via the shared 3x multiplier. |
| PDF to Image | Capped per page instead: the render scale is clamped so one page can never exceed a fixed pixel budget. |

`performance.memory` only exists in Chromium, so the heap check is a refinement
where it is available; the flat ceiling is what protects everyone else.

---

## Browser requirements

Tested on recent Chrome, Edge, Firefox, and Safari. Required APIs: `File`, `Blob`, `URL.createObjectURL`, `createImageBitmap`, `ServiceWorker` (for offline), Web Workers (for compress / PDF→image rendering).

---

## Framing and clickjacking

`frame-ancestors` is ignored when a Content-Security-Policy arrives in a
`<meta>` tag — it only works as a response header. The pages used to declare
it there, which meant they were fully frameable in practice.

`frame-guard.js` loads first in every page's `<head>`: if the page is framed it
hides the document before anything paints, then tries to replace the framing
page. A sandboxed frame can block that navigation, in which case the page just
stays hidden.

If you serve SecureKit somewhere you control the headers, add the real thing
as well — it is enforced by the browser rather than by page script:

```
Content-Security-Policy: frame-ancestors 'none'
```

---

## Project structure

```
SecureKit/
├── index.html               # Landing page with tool cards
├── merge.html        / merge.js
├── split.html        / split.js
├── compress.html     / compress.js
├── secure.html       / secure.js
├── pdf-to-image.html / pdf-to-image.js
├── image-to-pdf.html / image-to-pdf.js
├── shared-utils.js          # Workflow, progress, drag-and-drop, downloads
├── file-size-validation.js  # File-size limits, toast messages, sanitization
├── frame-guard.js           # Refuses to render inside a third-party frame
├── sw.js                    # Service worker (offline cache)
├── sw-register.js           # Service worker bootstrap
├── manifest.json            # Web app manifest (install metadata, shortcuts)
├── icons/
│   ├── icon.svg             # Source mark; also the scalable favicon
│   ├── icon-192.png         # Manifest icon (any + maskable)
│   ├── icon-512.png         # Manifest icon (any + maskable)
│   ├── apple-touch-icon.png # iOS home-screen icon (180x180)
│   └── favicon-32.png       # Fallback favicon for older browsers
├── *-style.css              # Per-tool styles
├── style.css                # Shared styles
└── lib/
    ├── pdf-lib.min.js       # PDF reading / writing
    ├── pdf.min.js           # PDF rendering
    ├── pdf.worker.min.js    # PDF.js worker
    ├── pdf-aes256.js        # AES-256 (PDF 2.0) encryption for the Secure tool
    └── jszip.min.js         # ZIP archive packing for batch downloads
```

---

## Local development

No build step — it's plain HTML/CSS/JS. But you do need a real HTTP server (not `file://`) for service workers and dynamic imports to work:

```bash
python -m http.server 8000
# then open http://localhost:8000/
```

Any equivalent works: `npx serve`, `caddy file-server`, `php -S localhost:8000`, etc.

---

## Updating vendored libraries

The vendored bundles in `lib/` are pinned for reproducibility (`pdf-aes256.js` is
ours, not vendored). To refresh:

```bash
cd lib
curl -o pdf-lib.min.js     https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js
curl -o pdf.min.js         https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
curl -o pdf.worker.min.js  https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
curl -o jszip.min.js       https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
```

After updating, bump `CACHE_VERSION` in `sw.js` so users get the new files instead of stale cached copies.

## Installing

SecureKit ships a web app manifest, so browsers offer it as an installable app
(Chrome/Edge: the install icon in the address bar; Safari on iOS: Share → Add to
Home Screen). Installed, it opens standalone with no browser chrome and runs
fully offline from the service-worker cache.

The manifest declares jump-list shortcuts for Merge, Split, Compress and Secure,
so the four most-used tools are reachable from the app icon's context menu.

Install requires a secure origin (`https://` or `localhost`), the same condition
the service worker and the Secure tool need.

The icon is a single source SVG (`icons/icon.svg`) rasterised to PNG. Its
artwork sits inside the maskable safe zone, so one file serves both the plain
and masked (circle / squircle) icon shapes without being clipped.

---

## Encryption

The Secure tool writes **AES-256 encryption** (PDF 2.0 standard security handler,
`/V 5 /R 6`) implemented in `lib/pdf-aes256.js` on top of the Web Crypto API:
ISO 32000-2 algorithms 2.B, 8, 9 and 10, with streams and strings encrypted as
AESV3 (AES-256-CBC, random IV per object).

- Web Crypto is only exposed on secure origins, so the Secure tool needs
  `https://` or `localhost` — the same requirement as the service worker.
- Readers must support AES-256: Acrobat X (2010) and later, current Preview,
  Chrome, Firefox, Edge and pdf.js. Acrobat 9 and older cannot open these files.
- Permission flags (`/P`) are enforced by the reader, not by cryptography, and
  only bind users who open with the user password — set a separate owner
  password for them to mean anything.

Earlier versions used a vendored RC4 128-bit library; it was removed in favour of
this module.

---

## Attribution

- [pdf-lib](https://pdf-lib.js.org/) — MIT — PDF creation and modification
- [PDF.js](https://mozilla.github.io/pdf.js/) — Apache 2.0 — PDF rendering
- `lib/pdf-aes256.js` — first-party; implements ISO 32000-2 AES-256 encryption on top of the Web Crypto API
- [JSZip](https://stuk.github.io/jszip/) — MIT — ZIP archive creation for batch downloads

---

## License

See [LICENSE](LICENSE).

Built by [Yashvardhan Jain](https://iamyvj.github.io/).
