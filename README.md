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
- **Service-worker-backed offline mode.** After your first visit, the entire app works without an internet connection.
- **Installable.** SecureKit is a PWA, so it can be installed to a desktop or home screen and launched in its own window — still with no backend and no network access required.

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

## Browser requirements

Tested on recent Chrome, Edge, Firefox, and Safari. Required APIs: `File`, `Blob`, `URL.createObjectURL`, `createImageBitmap`, `ServiceWorker` (for offline), Web Workers (for compress / PDF→image rendering).

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
