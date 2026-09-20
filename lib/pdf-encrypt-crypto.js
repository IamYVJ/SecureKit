/**
 * pdf-encrypt-lite 1.0.0 - Ultra-lightweight PDF encryption library
 * (c) PDFSmaller.com - MIT - https://github.com/pdfsmaller/pdf-encrypt-lite
 * Bundled by jsDelivr from /npm/@pdfsmaller/pdf-encrypt-lite@1.0.0/dist/index.mjs
 *
 * Implements the PDF Standard Security Handler (RC4 128-bit, revision 3).
 */

/**
 * LOCAL PATCH: the "crypto-minimal" chunk, split out of the jsDelivr bundle so
 * pdf-encrypt-lite.js can import it instead of calling require("./crypto-minimal").
 * Code is byte-for-byte as bundled; only the export statement is ours.
 */
var A=function(t){const e="string"==typeof t?(new TextEncoder).encode(t):t,n=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21],s=new Uint32Array([3614090360,3905402710,606105819,3250441966,4118548399,1200080426,2821735955,4249261313,1770035416,2336552879,4294925233,2304563134,1804603682,4254626195,2792965006,1236535329,4129170786,3225465664,643717713,3921069994,3593408605,38016083,3634488961,3889429448,568446438,3275163606,4107603335,1163531501,2850285829,4243563512,1735328473,2368359562,4294588738,2272392833,1839030562,4259657740,2763975236,1272893353,4139469664,3200236656,681279174,3936430074,3572445317,76029189,3654602809,3873151461,530742520,3299628645,4096336452,1126891415,2878612391,4237533241,1700485571,2399980690,4293915773,2240044497,1873313359,4264355552,2734768916,1309151649,4149444226,3174756917,718787259,3951481745]);let r=1732584193,o=4023233417,i=2562383102,c=271733878;const a=e.length,l=8*a,f=a+9+63&-64,h=new Uint8Array(f);h.set(e),h[a]=128;const g=new DataView(h.buffer);g.setUint32(f-8,l,!0),g.setUint32(f-4,0,!0);for(let t=0;t<f;t+=64){const e=new Uint32Array(h.buffer,t,16);let a=r,l=o,f=i,g=c;for(let t=0;t<64;t++){let r,o;t<16?(r=l&f|~l&g,o=t):t<32?(r=g&l|~g&f,o=(5*t+1)%16):t<48?(r=l^f^g,o=(3*t+5)%16):(r=f^(l|~g),o=7*t%16),r=r+a+s[t]+e[o]>>>0,a=g,g=f,f=l,l=l+(r<<n[t]|r>>>32-n[t])>>>0}r=r+a>>>0,o=o+l>>>0,i=i+f>>>0,c=c+g>>>0}const u=new Uint8Array(16),y=new DataView(u.buffer);return y.setUint32(0,r,!0),y.setUint32(4,o,!0),y.setUint32(8,i,!0),y.setUint32(12,c,!0),u},D=function(t){const e=new Uint8Array(t.length/2);for(let n=0;n<e.length;n++)e[n]=parseInt(t.substr(2*n,2),16);return e},b=function(t){return Array.from(t).map((t=>t.toString(16).padStart(2,"0"))).join("")},x=class{constructor(t){this.s=new Uint8Array(256),this.i=0,this.j=0;for(let t=0;t<256;t++)this.s[t]=t;let e=0;for(let n=0;n<256;n++)e=e+this.s[n]+t[n%t.length]&255,[this.s[n],this.s[e]]=[this.s[e],this.s[n]]}process(t){const e=new Uint8Array(t.length);for(let n=0;n<t.length;n++){this.i=this.i+1&255,this.j=this.j+this.s[this.i]&255,[this.s[this.i],this.s[this.j]]=[this.s[this.j],this.s[this.i]];const s=this.s[this.i]+this.s[this.j]&255;e[n]=t[n]^this.s[s]}return e}};

export { A as md5, D as hexToBytes, b as bytesToHex, x as RC4 };
