# SecureKit

**Privacy-first PDF toolkit. Six tools. Zero uploads.**

Everything runs in your browser — files never leave your device, even when offline.

Live site: open `index.html` locally, or host the folder on any static web host (GitHub Pages, Netlify, S3, your own server).

---

## Tools

| Tool | What it does |
| --- | --- |
| **Merge** | Combine multiple PDFs into one, with optional page selection and drag-to-reorder |
| **Split** | Extract pages, split by ranges, or split every N pages |
| **Compress** | Smart JPEG image recompression (preserves text, vectors, forms, links), with optional destructive page-flatten fallback |
| **Secure** | Add password protection and owner permissions to PDFs |
| **PDF to Image** | Render PDF pages to JPG or PNG at configurable quality and scale |
| **Image to PDF** | Combine JPG and PNG images into a single PDF with configurable page size and margins |

---

## Privacy guarantees

- **No uploads.** No backend, no servers. Open DevTools → Network and you'll see zero requests during processing.
- **No third-party CDNs at runtime.** All dependencies (`pdf-lib`, `pdf.js`, `pdf-encrypt-lite`) are vendored locally under `lib/`. The site can run completely air-gapped.
- **Locked-down CSP.** Every page declares `script-src 'self'` — even if a future change accidentally tried to load remote code, the browser would block it.
- **Service-worker-backed offline mode.** After your first visit, the entire app works without an internet connection.

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
├── *-style.css              # Per-tool styles
├── style.css                # Shared styles
└── lib/
    ├── pdf-lib.min.js       # PDF reading / writing
    ├── pdf.min.js           # PDF rendering
    ├── pdf.worker.min.js    # PDF.js worker
    ├── pdf-encrypt-lite.js  # Password encryption for Secure tool
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

The four bundles in `lib/` are pinned for reproducibility. To refresh:

```bash
cd lib
curl -o pdf-lib.min.js     https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js
curl -o pdf.min.js         https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
curl -o pdf.worker.min.js  https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
curl -L -o pdf-encrypt-lite.js  https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-encrypt-lite@1.0.0/+esm
curl -o jszip.min.js       https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
```

After updating, bump `CACHE_VERSION` in `sw.js` so users get the new files instead of stale cached copies.

---

## Hosting on GitHub Pages

1. Push the repo to GitHub.
2. Settings → Pages → Source: `main` branch, `/` (root).
3. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

All paths are relative, so the site works under any subpath.

---

## Attribution

- [pdf-lib](https://pdf-lib.js.org/) — MIT — PDF creation and modification
- [PDF.js](https://mozilla.github.io/pdf.js/) — Apache 2.0 — PDF rendering
- [@pdfsmaller/pdf-encrypt-lite](https://www.npmjs.com/package/@pdfsmaller/pdf-encrypt-lite) — PDF password encryption
- [JSZip](https://stuk.github.io/jszip/) — MIT — ZIP archive creation for batch downloads

---

## License

See [LICENSE](LICENSE).

Built by [Yashvardhan Jain](https://iamyvj.github.io/).
