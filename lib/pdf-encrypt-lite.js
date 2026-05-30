/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/@pdfsmaller/pdf-encrypt-lite@1.0.0/dist/index.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
 * Powers PDFSmaller.com's PDF encryption tool
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 * @see https://pdfsmaller.com/protect-pdf - Try it online!
 * 
 * This module implements PDF Standard Security Handler (Algorithm 2 & 3 from PDF spec)
 * Built to solve the "impossible" problem of real PDF encryption within edge constraints
 * 
 * Total size with crypto: ~7KB - when others are 2-20MB!
 * Battle-tested on thousands of PDFs at PDFSmaller.com
 */
const{PDFDocument:t,PDFName:e,PDFHexString:n,PDFString:s,PDFDict:r,PDFArray:o,PDFRawStream:i,PDFNumber:c}=require("pdf-lib"),{md5:a,RC4:l,hexToBytes:f,bytesToHex:h}=require("./crypto-minimal"),g=new Uint8Array([40,191,78,94,78,117,138,65,100,0,78,86,255,250,1,8,46,46,0,182,208,104,62,128,47,12,169,254,100,83,105,122]);function u(t){const e=(new TextEncoder).encode(t),n=new Uint8Array(32);return e.length>=32?n.set(e.slice(0,32)):(n.set(e),n.set(g.slice(0,32-e.length),e.length)),n}function y(t,e,n,s){const r=u(t),o=new Uint8Array(r.length+e.length+4+s.length);let i=0;o.set(r,i),i+=r.length,o.set(e,i),i+=e.length,o[i++]=255&n,o[i++]=n>>8&255,o[i++]=n>>16&255,o[i++]=n>>24&255,o.set(s,i);let c=a(o);for(let t=0;t<50;t++)c=a(c.slice(0,16));return c.slice(0,16)}function p(t,e){const n=u(t||e);let s=a(n);for(let t=0;t<50;t++)s=a(s);const r=u(e);let o=new Uint8Array(r);for(let t=0;t<20;t++){const e=new Uint8Array(s.length);for(let n=0;n<s.length;n++)e[n]=s[n]^t;o=new l(e.slice(0,16)).process(o)}return o}function w(t,e){const n=new Uint8Array(g.length+e.length);n.set(g),n.set(e,g.length);const s=a(n);let r=new l(t).process(s);for(let e=1;e<=19;e++){const n=new Uint8Array(t.length);for(let s=0;s<t.length;s++)n[s]=t[s]^e;r=new l(n).process(r)}const o=new Uint8Array(32);return o.set(r),o.set(new Uint8Array(16),16),o}function d(t,e,n,s){const r=new Uint8Array(s.length+5);r.set(s),r[s.length]=255&e,r[s.length+1]=e>>8&255,r[s.length+2]=e>>16&255,r[s.length+3]=255&n,r[s.length+4]=n>>8&255;const o=a(r);return new l(o.slice(0,Math.min(s.length+5,16))).process(t)}function m(t,e,i,c){if(t)if(t instanceof s){const n=d(t.asBytes(),e,i,c);t.value=h(n)}else if(t instanceof n){const n=d(f(t.asString()),e,i,c);t.value=h(n)}else if(t instanceof r){const n=t.entries();for(const[t,s]of n){const n=t.asString();"/Length"!==n&&"/Filter"!==n&&"/DecodeParms"!==n&&m(s,e,i,c)}}else if(t instanceof o){const n=t.asArray();for(const t of n)m(t,e,i,c)}}async function U(s,o,a=null){try{const l=await t.load(s,{ignoreEncryption:!0,updateMetadata:!1}),g=l.context;let u;const U=g.trailerInfo,A=U.ID;if(A&&Array.isArray(A)&&A.length>0){const t=A[0].toString().replace(/^<|>$/g,"");u=f(t)}else{const t=new Uint8Array(16);if("undefined"!=typeof crypto&&crypto.getRandomValues)crypto.getRandomValues(t);else for(let e=0;e<16;e++)t[e]=Math.floor(256*Math.random());u=t;const e=n.of(h(u)),s=n.of(h(u));U.ID=[e,s]}const D=4294967292,b=p(a,o),x=y(o,b,D,u),F=w(x,u),P=g.enumerateIndirectObjects();for(const[t,n]of P){const s=t.objectNumber,o=t.generationNumber||0;if(n instanceof r){const t=n.get(e.of("Filter"));if(t&&"/Standard"===t.asString())continue}if(n instanceof i){const t=d(n.contents,s,o,x);n.contents=t}m(n,s,o,x)}const S=g.obj({Filter:e.of("Standard"),V:c.of(2),R:c.of(3),Length:c.of(128),P:c.of(D),O:n.of(h(b)),U:n.of(h(F))}),j=g.register(S);U.Encrypt=j;return await l.save({useObjectStreams:!1})}catch(t){throw console.error("PDF encryption error:",t),new Error(`Failed to encrypt PDF: ${t.message}`)}}exports.padPassword=u,exports.computeEncryptionKey=y,exports.computeOwnerKey=p,exports.computeUserKey=w,exports.encryptObject=d,exports.encryptStringsInObject=m;var A=
/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
 * Powers PDFSmaller.com's PDF encryption tool
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 * @see https://pdfsmaller.com/protect-pdf - Try it online!
 * 
 * This minimal cryptographic implementation was built to solve the "impossible" 
 * problem of real PDF encryption within Cloudflare Workers' 1MB limit.
 * Total size: ~7KB for complete PDF encryption!
 */
function(t){const e="string"==typeof t?(new TextEncoder).encode(t):t,n=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21],s=new Uint32Array([3614090360,3905402710,606105819,3250441966,4118548399,1200080426,2821735955,4249261313,1770035416,2336552879,4294925233,2304563134,1804603682,4254626195,2792965006,1236535329,4129170786,3225465664,643717713,3921069994,3593408605,38016083,3634488961,3889429448,568446438,3275163606,4107603335,1163531501,2850285829,4243563512,1735328473,2368359562,4294588738,2272392833,1839030562,4259657740,2763975236,1272893353,4139469664,3200236656,681279174,3936430074,3572445317,76029189,3654602809,3873151461,530742520,3299628645,4096336452,1126891415,2878612391,4237533241,1700485571,2399980690,4293915773,2240044497,1873313359,4264355552,2734768916,1309151649,4149444226,3174756917,718787259,3951481745]);let r=1732584193,o=4023233417,i=2562383102,c=271733878;const a=e.length,l=8*a,f=a+9+63&-64,h=new Uint8Array(f);h.set(e),h[a]=128;const g=new DataView(h.buffer);g.setUint32(f-8,l,!0),g.setUint32(f-4,0,!0);for(let t=0;t<f;t+=64){const e=new Uint32Array(h.buffer,t,16);let a=r,l=o,f=i,g=c;for(let t=0;t<64;t++){let r,o;t<16?(r=l&f|~l&g,o=t):t<32?(r=g&l|~g&f,o=(5*t+1)%16):t<48?(r=l^f^g,o=(3*t+5)%16):(r=f^(l|~g),o=7*t%16),r=r+a+s[t]+e[o]>>>0,a=g,g=f,f=l,l=l+(r<<n[t]|r>>>32-n[t])>>>0}r=r+a>>>0,o=o+l>>>0,i=i+f>>>0,c=c+g>>>0}const u=new Uint8Array(16),y=new DataView(u.buffer);return y.setUint32(0,r,!0),y.setUint32(4,o,!0),y.setUint32(8,i,!0),y.setUint32(12,c,!0),u},D=function(t){const e=new Uint8Array(t.length/2);for(let n=0;n<e.length;n++)e[n]=parseInt(t.substr(2*n,2),16);return e},b=function(t){return Array.from(t).map((t=>t.toString(16).padStart(2,"0"))).join("")},x=class{constructor(t){this.s=new Uint8Array(256),this.i=0,this.j=0;for(let t=0;t<256;t++)this.s[t]=t;let e=0;for(let n=0;n<256;n++)e=e+this.s[n]+t[n%t.length]&255,[this.s[n],this.s[e]]=[this.s[e],this.s[n]]}process(t){const e=new Uint8Array(t.length);for(let n=0;n<t.length;n++){this.i=this.i+1&255,this.j=this.j+this.s[this.i]&255,[this.s[this.i],this.s[this.j]]=[this.s[this.j],this.s[this.i]];const s=this.s[this.i]+this.s[this.j]&255;e[n]=t[n]^this.s[s]}return e}};
/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library (7KB!)
 * 
 * Built by PDFSmaller.com - Your free PDF toolkit
 * Try it online at https://pdfsmaller.com/protect-pdf
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 * 
 * Why we built this:
 * - Existing libraries are 2-20MB (too large for edge environments)
 * - Cloudflare Workers has a 1MB limit
 * - We needed real PDF encryption that actually works
 * - Everyone said it was impossible... we proved them wrong!
 * 
 * Features:
 * - Real RC4 128-bit encryption
 * - Only ~7KB total size
 * - Works in browsers and edge environments
 * - PDF Standard compliant
 * - Zero dependencies (except pdf-lib)
 * 
 * This is the exact same encryption engine that powers PDFSmaller.com!
 * Battle-tested on thousands of PDFs daily.
 * 
 * @example
 * import { encryptPDF } from 'pdf-encrypt-lite';
 * 
 * const encryptedPdf = await encryptPDF(pdfBytes, 'password123');
 * 
 * // With separate owner password
 * const encryptedPdf = await encryptPDF(pdfBytes, 'user123', 'owner456');
 * 
 * @see https://pdfsmaller.com - Free PDF tools powered by this library
 * @see https://github.com/pdfsmaller/pdf-encrypt-lite - GitHub repo
 */
const F="1.0.0",P="https://pdfsmaller.com",S="PDFSmaller.com";export{P as HOMEPAGE,S as POWERED_BY,x as RC4,F as VERSION,b as bytesToHex,U as encryptPDF,D as hexToBytes,A as md5};export default null;
//# sourceMappingURL=/sm/e5421d4f1852666451c67057dc3e1564e7cd42bc43f632d09bdb08e552100920.map