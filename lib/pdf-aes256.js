/**
 * pdf-aes256 - PDF 2.0 AES-256 encryption (Standard Security Handler, /V 5 /R 6)
 * SecureKit - Client-Side PDF Processing
 *
 * Implements ISO 32000-2 algorithms 2.A/2.B (key derivation), 8 (/U, /UE),
 * 9 (/O, /OE) and 10 (/Perms), with document content encrypted as AESV3:
 * AES-256-CBC, a random IV per stream/string, PKCS#7 padding.
 *
 * All primitives come from the Web Crypto API - no vendored crypto code. That
 * means this module only runs on a secure origin (https:// or localhost), which
 * the app already requires for service workers and dynamic imports.
 *
 * Replaces the RC4 128-bit (/R 3) library this tool used previously. Readers
 * need AES-256 support: Acrobat X (2010) and later, current Preview, Chrome,
 * Firefox and pdf.js all qualify; Acrobat 9 and older do not.
 *
 * Depends on pdf-lib being loaded first (window.PDFLib), per our CSP.
 */

const pdfLib = globalThis.PDFLib;

if (!pdfLib || typeof pdfLib.PDFDocument !== 'function') {
    throw new Error('pdf-lib must be loaded (lib/pdf-lib.min.js) before pdf-aes256.');
}

const {
    PDFDocument,
    PDFName,
    PDFNumber,
    PDFString,
    PDFHexString,
    PDFDict,
    PDFArray,
    PDFRawStream,
    PDFBool
} = pdfLib;

// 0xFFFFFFFC: every permission granted, both reserved low bits clear.
export const ALL_PERMISSIONS = 4294967292;

// Reserved bits the spec fixes at 1 (7-8 and 13-32) and at 0 (1-2).
const PERMISSION_RESERVED_ONES = 0xFFFFF0C0;

const ZERO_IV = new Uint8Array(16);
const EMPTY = new Uint8Array(0);

// Passwords are UTF-8 and capped at 127 bytes for revision 6.
const MAX_PASSWORD_BYTES = 127;

function getSubtleCrypto() {
    const subtle = globalThis.crypto?.subtle;

    if (!subtle) {
        throw new Error(
            'AES-256 encryption needs the Web Crypto API, which browsers only provide '
            + 'on secure origins. Open this page over https:// or localhost.'
        );
    }

    return subtle;
}

function randomBytes(length) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
}

function concatBytes(...chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }

    return out;
}

function bytesToHex(bytes) {
    let hex = '';

    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }

    return hex;
}

function encodePassword(password) {
    const bytes = new TextEncoder().encode(password ?? '');
    return bytes.length > MAX_PASSWORD_BYTES ? bytes.slice(0, MAX_PASSWORD_BYTES) : bytes;
}

async function digest(algorithm, data) {
    return new Uint8Array(await getSubtleCrypto().digest(algorithm, data));
}

async function importAesKey(keyBytes) {
    return getSubtleCrypto().importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']);
}

/**
 * Web Crypto always PKCS#7-pads AES-CBC, but the key-derivation steps and the
 * /Perms block need raw CBC. Every input there is already a multiple of 16
 * bytes, so the padding lands in one extra trailing block we can drop.
 */
async function aesCbcNoPadding(key, iv, data) {
    const cryptoKey = key instanceof CryptoKey ? key : await importAesKey(key);
    const out = new Uint8Array(await getSubtleCrypto().encrypt({ name: 'AES-CBC', iv }, cryptoKey, data));
    return out.slice(0, data.length);
}

/**
 * ISO 32000-2, Algorithm 2.B. Hardens the password against brute force with at
 * least 64 rounds of AES-CBC plus SHA-256/384/512, the round count itself
 * depending on the data.
 */
async function hash2B(password, salt, userData) {
    let k = await digest('SHA-256', concatBytes(password, salt, userData));
    let e = new Uint8Array([0]);

    for (let round = 0; round < 64 || e[e.length - 1] > round - 32; round++) {
        const block = concatBytes(password, k, userData);
        const k1 = new Uint8Array(block.length * 64);

        for (let i = 0; i < 64; i++) {
            k1.set(block, i * block.length);
        }

        e = await aesCbcNoPadding(k.slice(0, 16), k.slice(16, 32), k1);

        let sum = 0;
        for (let i = 0; i < 16; i++) {
            sum += e[i];
        }

        const algorithm = ['SHA-256', 'SHA-384', 'SHA-512'][sum % 3];
        k = await digest(algorithm, e);
    }

    return k.slice(0, 32);
}

/** Algorithm 8 (user) and Algorithm 9 (owner) share this shape. */
async function buildPasswordEntry(password, fileKey, userData) {
    const validationSalt = randomBytes(8);
    const keySalt = randomBytes(8);

    const hash = await hash2B(password, validationSalt, userData);
    const intermediateKey = await hash2B(password, keySalt, userData);

    return {
        entry: concatBytes(hash, validationSalt, keySalt),
        encryptedKey: await aesCbcNoPadding(intermediateKey, ZERO_IV, fileKey)
    };
}

/**
 * Algorithm 10. A reader decrypts this block and checks the permissions in it
 * against /P, so a tampered /P is detectable. One AES block with no IV is ECB,
 * which CBC with a zero IV reproduces exactly.
 */
async function buildPerms(permissions, fileKey, encryptMetadata) {
    const perms = new Uint8Array(16);

    perms[0] = permissions & 0xFF;
    perms[1] = (permissions >> 8) & 0xFF;
    perms[2] = (permissions >> 16) & 0xFF;
    perms[3] = (permissions >> 24) & 0xFF;
    perms[4] = 0xFF;
    perms[5] = 0xFF;
    perms[6] = 0xFF;
    perms[7] = 0xFF;
    perms[8] = encryptMetadata ? 0x54 : 0x46; // 'T' or 'F'
    perms[9] = 0x61;  // 'a'
    perms[10] = 0x64; // 'd'
    perms[11] = 0x62; // 'b'
    perms.set(randomBytes(4), 12);

    return aesCbcNoPadding(fileKey, ZERO_IV, perms);
}

/**
 * AESV3 content encryption: a fresh random IV per stream or string, prepended
 * to the PKCS#7-padded ciphertext. Unlike RC4 handlers, /V 5 uses the file
 * encryption key directly - no per-object key derivation.
 */
function createContentEncryptor(cryptoKey) {
    return async function encryptBytes(data) {
        const iv = randomBytes(16);
        const ciphertext = new Uint8Array(
            await getSubtleCrypto().encrypt({ name: 'AES-CBC', iv }, cryptoKey, data)
        );

        return concatBytes(iv, ciphertext);
    };
}

function isStringObject(object) {
    return object instanceof PDFString || object instanceof PDFHexString;
}

function stringBytes(object) {
    if (object instanceof PDFHexString) {
        const hex = object.asString().replace(/[^0-9a-fA-F]/g, '');
        const padded = hex.length % 2 === 0 ? hex : hex + '0';
        const bytes = new Uint8Array(padded.length / 2);

        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
        }

        return bytes;
    }

    return object.asBytes();
}

/**
 * Encrypted strings are written back as hex strings whatever they started as:
 * ciphertext is arbitrary bytes, and a literal string would have to escape them.
 */
async function encryptStringsIn(object, encryptBytes, isEncryptDict) {
    if (isEncryptDict) {
        return;
    }

    if (object instanceof PDFDict) {
        for (const [key, value] of object.entries()) {
            if (isStringObject(value)) {
                object.set(key, PDFHexString.of(bytesToHex(await encryptBytes(stringBytes(value)))));
            } else {
                await encryptStringsIn(value, encryptBytes, false);
            }
        }

        return;
    }

    if (object instanceof PDFArray) {
        const items = object.asArray();

        for (let i = 0; i < items.length; i++) {
            const value = items[i];

            if (isStringObject(value)) {
                object.set(i, PDFHexString.of(bytesToHex(await encryptBytes(stringBytes(value)))));
            } else {
                await encryptStringsIn(value, encryptBytes, false);
            }
        }
    }
}

function looksLikeEncryptDict(object) {
    if (!(object instanceof PDFDict)) {
        return false;
    }

    return object.get(PDFName.of('Filter'))?.asString?.() === '/Standard'
        && Boolean(object.get(PDFName.of('O')) || object.get(PDFName.of('U')));
}

function normalizePermissions(permissions) {
    const requested = Number.isInteger(permissions) ? permissions : ALL_PERMISSIONS;
    return (requested | PERMISSION_RESERVED_ONES) & ~3;
}

function ensureDocumentId(context) {
    const existing = context.trailerInfo.ID;

    if (existing && Array.isArray(existing) && existing.length > 0) {
        return;
    }

    const id = PDFHexString.of(bytesToHex(randomBytes(16)));
    context.trailerInfo.ID = [id, id];
}

/**
 * Encrypt a PDF with AES-256 (PDF 2.0, /R 6).
 *
 * @param {Uint8Array} pdfBytes - the PDF to protect.
 * @param {string} userPassword - the password needed to open the document.
 * @param {string|null} ownerPassword - full-access password; defaults to the
 *   user password, in which case permission limits are not enforceable.
 * @param {number} permissions - /P bitmask; defaults to everything allowed.
 * @returns {Promise<Uint8Array>} the encrypted PDF.
 */
export async function encryptPDF(pdfBytes, userPassword, ownerPassword = null, permissions = ALL_PERMISSIONS) {
    getSubtleCrypto();

    if (!userPassword) {
        throw new Error('An open password is required to encrypt a PDF.');
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: true,
            updateMetadata: false
        });
        const context = pdfDoc.context;

        ensureDocumentId(context);

        const permissionBits = normalizePermissions(permissions);
        const encryptMetadata = true;

        // The document itself is encrypted with this key; the passwords only
        // unlock copies of it (/UE and /OE).
        const fileKey = randomBytes(32);
        const userBytes = encodePassword(userPassword);
        const ownerBytes = encodePassword(ownerPassword || userPassword);

        const user = await buildPasswordEntry(userBytes, fileKey, EMPTY);
        // Algorithm 9 mixes the 48-byte /U value into the owner hash.
        const owner = await buildPasswordEntry(ownerBytes, fileKey, user.entry);
        const perms = await buildPerms(permissionBits, fileKey, encryptMetadata);

        const encryptBytes = createContentEncryptor(await importAesKey(fileKey));

        for (const [, object] of context.enumerateIndirectObjects()) {
            if (looksLikeEncryptDict(object)) {
                continue;
            }

            if (object instanceof PDFRawStream) {
                object.contents = await encryptBytes(object.contents);
                await encryptStringsIn(object.dict, encryptBytes, false);
                continue;
            }

            await encryptStringsIn(object, encryptBytes, false);
        }

        const cryptFilter = context.obj({});
        cryptFilter.set(PDFName.of('CFM'), PDFName.of('AESV3'));
        cryptFilter.set(PDFName.of('AuthEvent'), PDFName.of('DocOpen'));
        cryptFilter.set(PDFName.of('Length'), PDFNumber.of(32));

        const cryptFilters = context.obj({});
        cryptFilters.set(PDFName.of('StdCF'), cryptFilter);

        const encryptDict = context.obj({});
        encryptDict.set(PDFName.of('Filter'), PDFName.of('Standard'));
        encryptDict.set(PDFName.of('V'), PDFNumber.of(5));
        encryptDict.set(PDFName.of('R'), PDFNumber.of(6));
        encryptDict.set(PDFName.of('Length'), PDFNumber.of(256));
        encryptDict.set(PDFName.of('CF'), cryptFilters);
        encryptDict.set(PDFName.of('StmF'), PDFName.of('StdCF'));
        encryptDict.set(PDFName.of('StrF'), PDFName.of('StdCF'));
        encryptDict.set(PDFName.of('P'), PDFNumber.of(permissionBits));
        encryptDict.set(PDFName.of('U'), PDFHexString.of(bytesToHex(user.entry)));
        encryptDict.set(PDFName.of('UE'), PDFHexString.of(bytesToHex(user.encryptedKey)));
        encryptDict.set(PDFName.of('O'), PDFHexString.of(bytesToHex(owner.entry)));
        encryptDict.set(PDFName.of('OE'), PDFHexString.of(bytesToHex(owner.encryptedKey)));
        encryptDict.set(PDFName.of('Perms'), PDFHexString.of(bytesToHex(perms)));
        encryptDict.set(PDFName.of('EncryptMetadata'), encryptMetadata ? PDFBool.True : PDFBool.False);

        context.trailerInfo.Encrypt = context.register(encryptDict);

        // Object streams would have to be encrypted as a unit and cross-reference
        // streams must stay plaintext; writing plain objects avoids both problems.
        return await pdfDoc.save({ useObjectStreams: false });
    } catch (error) {
        console.error('PDF encryption error:', error);
        throw new Error(`Failed to encrypt PDF: ${error.message}`);
    }
}

export const VERSION = '1.0.0';
export default null;
