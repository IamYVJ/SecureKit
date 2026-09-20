/**
 * pdf-encrypt-lite 1.0.0 - Ultra-lightweight PDF encryption library
 * (c) PDFSmaller.com - MIT - https://github.com/pdfsmaller/pdf-encrypt-lite
 * Bundled by jsDelivr from /npm/@pdfsmaller/pdf-encrypt-lite@1.0.0/dist/index.mjs
 *
 * Implements the PDF Standard Security Handler (RC4 128-bit, revision 3).
 */

/**
 * LOCAL PATCH: jsDelivr's "+esm" bundle of this package is not loadable in a browser.
 * It ships as one .js file that still contains top-level CommonJS calls -
 *   require("pdf-lib") and require("./crypto-minimal")
 * - plus writes to a bare `exports` object, so importing it threw
 * "ReferenceError: require is not defined" and the Secure tool never worked.
 *
 * The upstream code below is byte-for-byte unchanged except for those bindings:
 *   - pdf-lib now comes from the global `PDFLib` (loaded via <script> per our CSP)
 *   - the crypto helpers now come from ./pdf-encrypt-crypto.js, which holds the
 *     crypto-minimal chunk this bundle appended but never wired up
 *   - `exports` is a local throwaway object so the upstream assignments still run
 *
 * LOCAL FEATURE: encryptPDF takes a 4th argument, the /P permission bitmask
 * (default 4294967292 = everything allowed, the value upstream hardcoded). It is
 * normalized to a spec-legal /P and threaded through the encryption-key derivation,
 * which is the only correct place to set it.
 *
 * Re-fetching the CDN bundle will reintroduce the bug: re-apply this patch.
 */
import { md5, RC4, hexToBytes, bytesToHex } from './pdf-encrypt-crypto.js';

const pdfLib = globalThis.PDFLib;

if (!pdfLib || typeof pdfLib.PDFDocument !== 'function') {
    throw new Error('pdf-lib must be loaded (lib/pdf-lib.min.js) before pdf-encrypt-lite.');
}

// The upstream chunk assigns its internals onto `exports`; nothing reads them back.
const exports = {};

const{PDFDocument:t,PDFName:e,PDFHexString:n,PDFString:s,PDFDict:r,PDFArray:o,PDFRawStream:i,PDFNumber:c}=pdfLib,{md5:a,RC4:l,hexToBytes:f,bytesToHex:h}={ md5, RC4, hexToBytes, bytesToHex },g=new Uint8Array([40,191,78,94,78,117,138,65,100,0,78,86,255,250,1,8,46,46,0,182,208,104,62,128,47,12,169,254,100,83,105,122]);function u(t){const e=(new TextEncoder).encode(t),n=new Uint8Array(32);return e.length>=32?n.set(e.slice(0,32)):(n.set(e),n.set(g.slice(0,32-e.length),e.length)),n}function y(t,e,n,s){const r=u(t),o=new Uint8Array(r.length+e.length+4+s.length);let i=0;o.set(r,i),i+=r.length,o.set(e,i),i+=e.length,o[i++]=255&n,o[i++]=n>>8&255,o[i++]=n>>16&255,o[i++]=n>>24&255,o.set(s,i);let c=a(o);for(let t=0;t<50;t++)c=a(c.slice(0,16));return c.slice(0,16)}function p(t,e){const n=u(t||e);let s=a(n);for(let t=0;t<50;t++)s=a(s);const r=u(e);let o=new Uint8Array(r);for(let t=0;t<20;t++){const e=new Uint8Array(s.length);for(let n=0;n<s.length;n++)e[n]=s[n]^t;o=new l(e.slice(0,16)).process(o)}return o}function w(t,e){const n=new Uint8Array(g.length+e.length);n.set(g),n.set(e,g.length);const s=a(n);let r=new l(t).process(s);for(let e=1;e<=19;e++){const n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t[s]^e;r=new l(n).process(r)}const o=new Uint8Array(32);return o.set(r),o.set(new Uint8Array(16),16),o}function d(t,e,n,s){const r=new Uint8Array(s.length+5);r.set(s),r[s.length]=255&e,r[s.length+1]=e>>8&255,r[s.length+2]=e>>16&255,r[s.length+3]=255&n,r[s.length+4]=n>>8&255;const o=a(r);return new l(o.slice(0,Math.min(s.length+5,16))).process(t)}function m(t,e,i,c){if(t)if(t instanceof s){const n=d(t.asBytes(),e,i,c);t.value=h(n)}else if(t instanceof n){const n=d(f(t.asString()),e,i,c);t.value=h(n)}else if(t instanceof r){const n=t.entries();for(const[t,s]of n){const n=t.asString();"/Length"!==n&&"/Filter"!==n&&"/DecodeParms"!==n&&m(s,e,i,c)}}else if(t instanceof o){const n=t.asArray();for(const t of n)m(t,e,i,c)}}async function U(s,o,a=null,PERMS=4294967292){try{const l=await t.load(s,{ignoreEncryption:!0,updateMetadata:!1}),g=l.context;let u;const U=g.trailerInfo,A=U.ID;if(A&&Array.isArray(A)&&A.length>0){const t=A[0].toString().replace(/^<|>$/g,"");u=f(t)}else{const t=new Uint8Array(16);if("undefined"!=typeof crypto&&crypto.getRandomValues)crypto.getRandomValues(t);else for(let e=0;e<16;e++)t[e]=Math.floor(256*Math.random());u=t;const e=n.of(h(u)),s=n.of(h(u));U.ID=[e,s]}const D=(PERMS|0xFFFFF0C0)&~3,b=p(a,o),x=y(o,b,D,u),F=w(x,u),P=g.enumerateIndirectObjects();for(const[t,n]of P){const s=t.objectNumber,o=t.generationNumber||0;if(n instanceof r){const t=n.get(e.of("Filter"));if(t&&"/Standard"===t.asString())continue}if(n instanceof i){const t=d(n.contents,s,o,x);n.contents=t}m(n,s,o,x)}const S=g.obj({Filter:e.of("Standard"),V:c.of(2),R:c.of(3),Length:c.of(128),P:c.of(D),O:n.of(h(b)),U:n.of(h(F))}),j=g.register(S);U.Encrypt=j;return await l.save({useObjectStreams:!1})}catch(t){throw console.error("PDF encryption error:",t),new Error(`Failed to encrypt PDF: ${t.message}`)}}exports.padPassword=u,exports.computeEncryptionKey=y,exports.computeOwnerKey=p,exports.computeUserKey=w,exports.encryptObject=d,exports.encryptStringsInObject=m;

const VERSION = "1.0.0", HOMEPAGE = "https://pdfsmaller.com", POWERED_BY = "PDFSmaller.com";

export { U as encryptPDF, VERSION, HOMEPAGE, POWERED_BY, md5, RC4, hexToBytes, bytesToHex };
export default null;
