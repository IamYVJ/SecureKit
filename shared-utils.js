// ============================================
// SHARED UTILITIES MODULE
// SecureKit - Client-Side PDF Processing
// Common functions used across all PDF operations
// ============================================

// ============================================
// FILE SIZE FORMATTING
// ============================================

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
    try {
        if (typeof bytes !== 'number' || bytes < 0) {
            return '0 Bytes';
        }

        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        if (i < 0 || i >= sizes.length) {
            return bytes + ' Bytes';
        }

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];

    } catch (error) {
        console.error('Error in formatFileSize:', error);
        return bytes + ' Bytes';
    }
}

// ============================================
// FILENAME GENERATION
// ============================================

/**
 * Generate default filename with timestamp
 * @param {string} prefix - Filename prefix (e.g., 'MergedPDF', 'SplitPDF')
 * @returns {string} - Generated filename
 */
function getDefaultFilename(prefix = 'PDF') {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${prefix}_${year}${month}${day}`;
    } catch (error) {
        console.error('Error generating default filename:', error);
        return prefix;
    }
}

// ============================================
// FILE DOWNLOAD UTILITIES
// ============================================

/**
 * Download PDF with proper error handling and cleanup
 * @param {Uint8Array} pdfBytes - PDF file bytes
 * @param {string} filename - Download filename (without extension)
 */
async function downloadPDF(pdfBytes, filename) {
    try {
        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error('PDF data is empty');
        }

        // Sanitize filename
        let sanitizedName = sanitizeFilename(filename);
        if (!sanitizedName) {
            sanitizedName = 'document';
        }

        // Create blob and download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = sanitizedName + '.pdf';
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        return true;

    } catch (error) {
        console.error('Error downloading PDF:', error);
        throw error;
    }
}

/**
 * Download multiple PDFs with delay to prevent browser blocking
 * @param {Array} pdfDataArray - Array of {bytes, filename} objects
 * @param {number} delay - Delay between downloads in ms
 */
async function downloadMultiplePDFs(pdfDataArray, delay = 100) {
    const results = {
        successful: 0,
        failed: 0,
        errors: []
    };

    for (let i = 0; i < pdfDataArray.length; i++) {
        try {
            const { bytes, filename } = pdfDataArray[i];
            await downloadPDF(bytes, filename);
            results.successful++;

            // Add delay between downloads (except for last one)
            if (i < pdfDataArray.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } catch (error) {
            results.failed++;
            results.errors.push({
                filename: pdfDataArray[i].filename,
                error: error.message
            });
        }
    }

    return results;
}

// ============================================
// DOM MANIPULATION HELPERS
// ============================================

/**
 * Setup accordion toggle functionality
 * @param {HTMLElement} toggleElement - Toggle button element
 * @param {HTMLElement} contentElement - Content element to show/hide
 */
function setupAccordion(toggleElement, contentElement) {
    if (!toggleElement || !contentElement) {
        console.warn('Accordion elements not found');
        return;
    }

    try {
        // Start from whatever the markup says, so the attribute and the class
        // can never disagree.
        toggleElement.setAttribute('aria-expanded',
            contentElement.classList.contains('active') ? 'true' : 'false');

        toggleElement.addEventListener('click', () => {
            try {
                toggleElement.classList.toggle('active');
                const open = contentElement.classList.toggle('active');
                toggleElement.setAttribute('aria-expanded', open ? 'true' : 'false');
            } catch (error) {
                console.error('Error toggling accordion:', error);
            }
        });
    } catch (error) {
        console.error('Error setting up accordion:', error);
    }
}

/**
 * Setup drag and drop for file upload
 * @param {HTMLElement} uploadArea - Upload area element
 * @param {Function} onFilesDrop - Callback function when files are dropped
 * @param {Object} options - Configuration options
 */
function setupDragAndDrop(uploadArea, onFilesDrop, options = {}) {
    const {
        allowMultiple = true,
        fileType = 'application/pdf',
        dragOverClass = 'drag-over',
        rejectMessage = 'Please drop supported files only.'
    } = options;

    const allowedTypes = Array.isArray(fileType) ? fileType : [fileType];

    if (!uploadArea) {
        console.warn('Upload area element not found');
        return;
    }

    try {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add(dragOverClass);
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove(dragOverClass);
        });

        uploadArea.addEventListener('drop', (e) => {
            try {
                e.preventDefault();
                uploadArea.classList.remove(dragOverClass);

                const files = Array.from(e.dataTransfer.files).filter(file => {
                    if (allowedTypes.includes(file.type)) {
                        return true;
                    }
                    console.warn('Skipping unsupported file:', file.name, file.type);
                    return false;
                });

                if (files.length === 0) {
                    showWarningMessage(rejectMessage);
                    return;
                }

                if (!allowMultiple && files.length > 1) {
                    showWarningMessage('Please drop only one PDF file at a time. Using the first file.');
                    onFilesDrop([files[0]]);
                } else {
                    onFilesDrop(files);
                }

            } catch (error) {
                console.error('Error handling file drop:', error);
                showErrorMessage('Failed to process dropped files. Please try using the file selector instead.');
            }
        });

    } catch (error) {
        console.error('Error setting up drag and drop:', error);
    }
}

/**
 * Setup radio button change handlers
 * @param {string} radioName - Name attribute of radio buttons
 * @param {Function} onChange - Callback when radio changes
 */
function setupRadioButtons(radioName, onChange) {
    try {
        const radioButtons = document.querySelectorAll(`input[name="${radioName}"]`);
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                try {
                    onChange(e);
                } catch (error) {
                    console.error('Error in radio button change handler:', error);
                }
            });
        });
    } catch (error) {
        console.error('Error setting up radio buttons:', error);
    }
}

/**
 * Show/hide elements based on radio selection
 * @param {Event} e - Radio change event
 * @param {string} wrapperSelector - Selector for wrapper elements to show/hide
 */
function handleRadioToggle(e, wrapperSelector = '.radio-input-wrapper') {
    try {
        // Hide all wrappers
        document.querySelectorAll(wrapperSelector).forEach(wrapper => {
            wrapper.style.display = 'none';
        });

        // Show the selected one
        const selectedRadio = e.target;
        const wrapper = selectedRadio.parentElement.querySelector(wrapperSelector);
        if (wrapper) {
            wrapper.style.display = 'block';
        }
    } catch (error) {
        console.error('Error in handleRadioToggle:', error);
    }
}

// ============================================
// PDF VALIDATION HELPERS
// ============================================

/**
 * Validate if file is a PDF
 * @param {File} file - File to validate
 * @returns {boolean} - True if valid PDF
 */
function isPDF(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Load PDF and get page count
 * @param {File} file - PDF file to load
 * @returns {Promise<Object>} - { pdfDoc, pageCount, error }
 */
async function loadPDFWithValidation(file) {
    try {
        // Validate file type
        if (!isPDF(file)) {
            return {
                pdfDoc: null,
                pageCount: 0,
                error: `"${file.name}" is not a PDF file`
            };
        }

        // Load file
        const arrayBuffer = await file.arrayBuffer();

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            return {
                pdfDoc: null,
                pageCount: 0,
                error: 'File is empty or corrupted'
            };
        }

        // Load as PDF
        let pdfDoc;
        try {
            const { PDFDocument } = PDFLib;
            pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
        } catch (loadError) {
            let errorMsg = 'Failed to load PDF';

            if (loadError.message.includes('encrypted') || loadError.message.includes('password')) {
                errorMsg = 'PDF is password-protected';
            } else if (loadError.message.includes('Invalid') || loadError.message.includes('parse')) {
                errorMsg = 'Invalid or corrupted PDF';
            }

            return {
                pdfDoc: null,
                pageCount: 0,
                error: errorMsg
            };
        }

        const pageCount = pdfDoc.getPageCount();

        if (pageCount === 0) {
            return {
                pdfDoc: null,
                pageCount: 0,
                error: 'PDF has no pages'
            };
        }

        return {
            pdfDoc: pdfDoc,
            pageCount: pageCount,
            error: null
        };

    } catch (error) {
        console.error('Error loading PDF:', error);
        return {
            pdfDoc: null,
            pageCount: 0,
            error: error.message || 'Failed to load PDF'
        };
    }
}

// ============================================
// PAGE SELECTION PARSING
// ============================================

/**
 * Parse page selection string (e.g., "1,3,5-7")
 * @param {string} input - Page selection string
 * @param {number} maxPages - Maximum page number
 * @returns {Object} - { pages: Array, error: string|null }
 */
function parsePageSelection(input, maxPages) {
    try {
        if (!input || typeof input !== 'string') {
            return { pages: [], error: 'No page selection provided' };
        }

        const pages = new Set();
        const parts = input.split(',').map(p => p.trim()).filter(p => p);

        if (parts.length === 0) {
            return { pages: [], error: 'No pages specified' };
        }

        for (const part of parts) {
            // Check for range (e.g., "5-10")
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(p => p.trim());

                const startNum = parseInt(start, 10);
                const endNum = parseInt(end, 10);

                if (isNaN(startNum) || isNaN(endNum)) {
                    return {
                        pages: [],
                        error: `Invalid range "${part}". Use numbers only (e.g., "1-5").`
                    };
                }

                if (startNum < 1 || endNum > maxPages) {
                    return {
                        pages: [],
                        error: `Range "${part}" is out of bounds. PDF has ${maxPages} pages.`
                    };
                }

                if (startNum > endNum) {
                    return {
                        pages: [],
                        error: `Range "${part}" is invalid. Start page (${startNum}) cannot be greater than end page (${endNum}).`
                    };
                }

                for (let i = startNum; i <= endNum; i++) {
                    pages.add(i);
                }
            } else {
                // Single page number
                const pageNum = parseInt(part, 10);

                if (isNaN(pageNum)) {
                    return {
                        pages: [],
                        error: `Invalid page number "${part}". Use numbers only.`
                    };
                }

                if (pageNum < 1 || pageNum > maxPages) {
                    return {
                        pages: [],
                        error: `Page ${pageNum} is out of bounds. PDF has ${maxPages} pages.`
                    };
                }

                pages.add(pageNum);
            }
        }

        if (pages.size === 0) {
            return { pages: [], error: 'No valid pages selected' };
        }

        return { pages: Array.from(pages).sort((a, b) => a - b), error: null };

    } catch (error) {
        console.error('Error parsing page selection:', error);
        return { pages: [], error: 'Invalid page selection format' };
    }
}

// ============================================
// PROCESSING STATE MANAGEMENT
// ============================================

/**
 * Set processing state and update UI
 * @param {boolean} processing - Processing state
 * @param {HTMLElement} button - Button element to disable/enable
 * @param {HTMLElement} processingSection - Processing section to show/hide
 * @param {string} originalText - Original button text
 * @param {string} processingText - Text to show during processing
 */
function setProcessingState(processing, button, processingSection, originalText, processingText) {
    try {
        const labelElement = button?.querySelector('span');

        if (processing) {
            if (button) {
                button.disabled = true;
                if (labelElement) {
                    labelElement.textContent = processingText || 'Processing...';
                } else {
                    button.textContent = processingText || 'Processing...';
                }
            }
            if (processingSection) {
                processingSection.style.display = 'flex';
            }
        } else {
            if (button) {
                button.disabled = false;
                if (labelElement) {
                    labelElement.textContent = originalText || 'Process';
                } else {
                    button.textContent = originalText || 'Process';
                }
            }
            if (processingSection) {
                processingSection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error setting processing state:', error);
    }
}

// ============================================
// ZIP ARCHIVE DOWNLOAD
// ============================================

/**
 * Pack a set of files into a single ZIP and trigger one download.
 * Requires JSZip to be loaded on the page.
 *
 * @param {Array} items - Array of { filename, bytes?: Uint8Array, blob?: Blob }
 * @param {string} archiveName - Output filename (without .zip extension)
 * @returns {Promise<{successful: number, failed: number, errors: Array}>}
 */
async function downloadAsZip(items, archiveName) {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip is not loaded on this page.');
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No files to archive.');
    }

    const zip = new JSZip();
    const errors = [];
    let added = 0;

    for (const item of items) {
        try {
            const content = item.blob ?? item.bytes;
            if (!content) {
                errors.push({ filename: item.filename, error: 'No content' });
                continue;
            }
            zip.file(item.filename, content);
            added++;
        } catch (e) {
            errors.push({ filename: item.filename, error: e.message || 'Failed to add' });
        }
    }

    if (added === 0) {
        throw new Error('Could not add any files to the archive.');
    }

    // PDFs and JPEGs/PNGs are already compressed — STORE avoids redundant work.
    const archiveBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

    const safeName = (typeof sanitizeFilename === 'function' ? sanitizeFilename(archiveName) : archiveName) || 'archive';
    const url = URL.createObjectURL(archiveBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName + '.zip';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);

    return {
        successful: added,
        failed: errors.length,
        errors
    };
}

// ============================================
// CANCELLATION
// ============================================

/**
 * Cooperative cancellation for long runs. Work loops check the token at their
 * own await points, so a cancelled run always stops between whole steps and
 * never leaves a half-written PDF behind.
 *
 * @returns {Object} - { cancelled, cancel(), throwIfCancelled() }
 */
function createCancellation() {
    let cancelled = false;

    return {
        get cancelled() {
            return cancelled;
        },
        cancel() {
            cancelled = true;
        },
        throwIfCancelled() {
            if (cancelled) {
                const error = new Error('Operation cancelled.');
                error.name = 'CancelledError';
                throw error;
            }
        }
    };
}

/**
 * True for the error thrown by throwIfCancelled(), so tools can tell a user
 * cancellation apart from a genuine failure.
 */
function isCancellation(error) {
    return error?.name === 'CancelledError';
}

/**
 * Wire the Cancel button shown during processing.
 *
 * @param {HTMLElement} button - the in-progress cancel button
 * @param {Function} onStop - called once when the user asks to stop
 * @returns {Function} - resets the button for the next run
 */
function setupStopButton(button, onStop) {
    if (!button) {
        return () => {};
    }

    const label = button.querySelector('span');
    const defaultText = label?.textContent || 'Cancel';

    button.addEventListener('click', () => {
        // The work stops at its next checkpoint, so say so rather than
        // leaving a button that looks unresponsive.
        button.disabled = true;

        if (label) {
            label.textContent = 'Cancelling...';
        }

        onStop();
    });

    return () => {
        button.disabled = false;

        if (label) {
            label.textContent = defaultText;
        }
    };
}

// ============================================
// MEMORY BUDGET
// ============================================

/*
 * checkAvailableMemory() can only refuse work on browsers that expose
 * performance.memory (Chromium). Elsewhere it never blocks, and even where it
 * does, the heap limit is generous enough to wave through a batch that would
 * make the tab crawl.
 *
 * This ceiling is the backstop: a flat cap that applies in every browser. Each
 * tool estimates its own peak - the costs differ wildly, from a JPEG that is
 * embedded untouched to a PNG that is decoded to raw pixels - and then passes
 * the number here.
 */
const MAX_ESTIMATED_MEMORY = 1024 * 1024 * 1024;

/**
 * Decide whether an operation's estimated peak memory is acceptable.
 *
 * @param {number} estimatedBytes - Estimated peak usage
 * @param {string} [advice] - Tool-specific suggestion appended to a refusal
 * @returns {Object} - { ok, error, warning }
 */
function checkMemoryBudget(estimatedBytes, advice) {
    const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(0);

    if (estimatedBytes > MAX_ESTIMATED_MEMORY) {
        const limitMB = (MAX_ESTIMATED_MEMORY / (1024 * 1024)).toFixed(0);
        return {
            ok: false,
            error: `This needs roughly ${estimatedMB} MB of memory, over the `
                 + `${limitMB} MB limit.` + (advice ? '\n' + advice : ''),
            warning: null
        };
    }

    const available = checkAvailableMemory(estimatedBytes);
    if (!available.hasEnough) {
        return {
            ok: false,
            error: available.warning
                || `Not enough memory for this operation (needs about ${estimatedMB} MB).`,
            warning: null
        };
    }

    return { ok: true, error: null, warning: available.warning || null };
}

// ============================================
// TOOL-TO-TOOL FILE HANDOFF
// ============================================

/*
 * Passing a file from one tool page to another survives a full navigation, so
 * it has to go through storage.
 *
 * sessionStorage was the original route, but it only holds strings: the file
 * had to be base64-encoded (+33%) and then stored as UTF-16 (x2), costing about
 * 2.67x the PDF's size, and building a single string of tens of millions of
 * characters on the way. Measured in Chromium, that capped the handoff at a
 * 36-38MB PDF, and other engines allow far less. Merge accepts 200MB of input,
 * so a merged file can easily exceed it.
 *
 * IndexedDB stores a Blob natively: no encoding, no doubling, and a quota in
 * the hundreds of MB. sessionStorage remains as a fallback for the rare case
 * where IndexedDB is unavailable (blocked storage, some private modes).
 */

const HANDOFF_DB_NAME = 'securekit-handoff';
const HANDOFF_STORE_NAME = 'files';

/*
 * Unlike sessionStorage, IndexedDB outlives the tab. A handoff takes seconds,
 * so anything older than this was abandoned and should not be left sitting on
 * someone's disk.
 */
const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

function openHandoffDatabase() {
    return new Promise((resolve, reject) => {
        let request;

        try {
            request = indexedDB.open(HANDOFF_DB_NAME, 1);
        } catch (error) {
            reject(error);
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(HANDOFF_STORE_NAME)) {
                db.createObjectStore(HANDOFF_STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB open was blocked'));
    });
}

function awaitTransaction(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

/**
 * Drop handoff records left behind by a transfer that was never completed.
 *
 * @param {IDBDatabase} db - Open handoff database
 */
async function purgeStaleHandoffs(db) {
    const cutoff = Date.now() - HANDOFF_MAX_AGE_MS;
    const transaction = db.transaction(HANDOFF_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(HANDOFF_STORE_NAME);

    store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
            return;
        }
        // A record without a timestamp predates this field; treat it as stale.
        if (!cursor.value?.storedAt || cursor.value.storedAt < cutoff) {
            cursor.delete();
        }
        cursor.continue();
    };

    await awaitTransaction(transaction);
}

/**
 * Hand a file to another tool page.
 *
 * @param {string} key - Identifies the handoff
 * @param {File} file - File to pass along
 * @returns {Promise<boolean>} - True once the file is safely stored
 */
async function storeHandoffFile(key, file) {
    try {
        const db = await openHandoffDatabase();

        try {
            await purgeStaleHandoffs(db);

            const transaction = db.transaction(HANDOFF_STORE_NAME, 'readwrite');
            transaction.objectStore(HANDOFF_STORE_NAME).put({
                file,
                filename: file.name,
                mimeType: file.type,
                storedAt: Date.now()
            }, key);

            // Resolves only once the write is durable, so the caller can
            // navigate away immediately afterwards without losing it.
            await awaitTransaction(transaction);
            return true;
        } finally {
            db.close();
        }
    } catch (error) {
        console.warn('IndexedDB handoff unavailable, falling back to sessionStorage:', error);
        return storeHandoffFileFallback(key, file);
    }
}

/**
 * Collect a file handed over by another tool page, and clear it.
 *
 * @param {string} key - Identifies the handoff
 * @returns {Promise<File|null>} - The file, or null if there is nothing waiting
 */
async function takeHandoffFile(key) {
    try {
        const db = await openHandoffDatabase();

        try {
            const readTransaction = db.transaction(HANDOFF_STORE_NAME, 'readonly');
            const request = readTransaction.objectStore(HANDOFF_STORE_NAME).get(key);
            await awaitTransaction(readTransaction);

            const record = request.result;

            if (record) {
                // Read once: the file is consumed, and nothing is left behind.
                const deleteTransaction = db.transaction(HANDOFF_STORE_NAME, 'readwrite');
                deleteTransaction.objectStore(HANDOFF_STORE_NAME).delete(key);
                await awaitTransaction(deleteTransaction);
            }

            await purgeStaleHandoffs(db);

            if (record?.file) {
                return new File([record.file], record.filename || 'document.pdf', {
                    type: record.mimeType || 'application/pdf'
                });
            }
        } finally {
            db.close();
        }
    } catch (error) {
        console.warn('Could not read IndexedDB handoff:', error);
    }

    // Either IndexedDB is unavailable, or the file was stored by the fallback.
    return takeHandoffFileFallback(key);
}

/**
 * sessionStorage fallback. Size-limited by base64 and UTF-16 overhead, so it is
 * only reached when IndexedDB cannot be used at all.
 */
function storeHandoffFileFallback(key, file) {
    return file.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }

        sessionStorage.setItem(key, JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            bytesBase64: btoa(binary)
        }));

        return true;
    }).catch((error) => {
        console.error('sessionStorage handoff failed:', error);
        return false;
    });
}

function takeHandoffFileFallback(key) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) {
            return null;
        }

        sessionStorage.removeItem(key);
        const payload = JSON.parse(raw);
        if (!payload?.bytesBase64 || !payload?.filename) {
            return null;
        }

        const binary = atob(payload.bytesBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new File([bytes], payload.filename, {
            type: payload.mimeType || 'application/pdf'
        });
    } catch (error) {
        console.error('Could not read sessionStorage handoff:', error);
        try {
            sessionStorage.removeItem(key);
        } catch (removeError) {
            console.warn('Could not clear sessionStorage handoff:', removeError);
        }
        return null;
    }
}

// ============================================
// ACCESSIBILITY HELPERS
// ============================================

let liveRegion = null;

/**
 * Announce a message to screen readers without moving focus or showing
 * anything on screen. Used for changes that have no visible focus target,
 * such as reordering or removing a file from the list.
 *
 * @param {string} message - Text to announce
 */
function announce(message) {
    try {
        if (!message) {
            return;
        }

        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('role', 'status');
            liveRegion.setAttribute('aria-live', 'polite');
            document.body.appendChild(liveRegion);
        }

        // Re-announce even when the text is unchanged (e.g. moving the same
        // item twice): clearing first forces the region to fire again.
        liveRegion.textContent = '';
        window.setTimeout(() => {
            liveRegion.textContent = message;
        }, 50);
    } catch (error) {
        console.error('Error announcing message:', error);
    }
}

/**
 * Removing a row destroys the button that had focus, which drops the user at
 * the top of the document. Move focus to the row that took its place, or to a
 * sensible fallback when the list is now empty.
 *
 * @param {HTMLElement} listElement - Container holding the rows
 * @param {number} removedIndex - Index of the row that was removed
 * @param {string} buttonSelector - Selector for the button to focus within a row
 * @param {HTMLElement} [fallback] - Focused when no rows remain
 */
function focusAfterRemoval(listElement, removedIndex, buttonSelector, fallback) {
    try {
        // Hidden elements cannot take focus; focus() on one silently drops the
        // user at the top of the document. Every candidate is checked first.
        const isVisible = el => Boolean(el) && el.offsetParent !== null;

        const rows = listElement ? listElement.children : [];

        if (rows.length > 0) {
            const next = rows[Math.min(removedIndex, rows.length - 1)];
            const button = next?.querySelector(buttonSelector);

            // When the last row goes, the tool hides the whole files section
            // but leaves its markup in place, so a row can still be found here
            // while being invisible.
            if (isVisible(button)) {
                button.focus();
                return;
            }
        }

        // Back at the upload section: the caller's fallback (usually
        // "Add More") lives in the section that was just hidden.
        const usable = isVisible(fallback)
            ? fallback
            : document.getElementById('browseButton');
        usable?.focus();
    } catch (error) {
        console.error('Error restoring focus after removal:', error);
    }
}

/**
 * Move focus to a heading that has just been revealed. Screen readers announce
 * the heading, so the user is told where they landed instead of being dropped
 * silently at the top of the document.
 *
 * @param {HTMLElement} element - Heading (or container) to focus
 */
function focusHeading(element) {
    try {
        if (!element) {
            return false;
        }

        // Headings are not focusable by default; -1 allows programmatic focus
        // without adding a tab stop.
        if (!element.hasAttribute('tabindex')) {
            element.setAttribute('tabindex', '-1');
        }
        element.setAttribute('data-stage-heading', '');
        element.focus({ preventScroll: true });
        return document.activeElement === element;
    } catch (error) {
        console.error('Error moving focus to heading:', error);
        return false;
    }
}

// ============================================
// WORKFLOW STAGE MANAGEMENT
// ============================================

/**
 * Apply a workflow stage to the UI (show/hide sections, optionally scroll).
 * The "setup" stage delegates back to a tool-specific handler since each tool's
 * setup layout differs (single-file vs multi-file vs reorderable list).
 *
 * @param {string} stage - 'setup' | 'processing' | 'completed'
 * @param {Object} sections - { upload, files, processing, completion, info }
 * @param {Object} [options]
 * @param {boolean} [options.scrollOnTransition=false] - Scroll into view on processing/completed
 * @param {Function} [options.setupHandler] - Called with sections when stage === 'setup'
 */
let lastAppliedStage = null;

/**
 * Hiding the section that held focus drops the user at the top of the
 * document with nothing announced. After each real stage change, move focus
 * into whichever section just became visible.
 *
 * Skipped on the very first call so the page does not steal focus on load.
 */
function moveFocusForStage(stage, sections) {
    const previousStage = lastAppliedStage;
    lastAppliedStage = stage;

    if (previousStage === null || previousStage === stage) {
        return;
    }

    const { upload, files, processing, completion } = sections || {};

    if (stage === 'processing') {
        focusHeading(processing?.querySelector('h1, h2, h3, h4'));
        return;
    }

    if (stage === 'completed') {
        focusHeading(completion?.querySelector('h1, h2, h3, h4'));
        return;
    }

    // Back to setup (a cancel, or starting over): land on whichever of the two
    // setup sections the tool chose to show.
    const visible = [files, upload].find(el => el && el.style.display !== 'none');
    if (focusHeading(visible?.querySelector('h1, h2, h3, h4'))) {
        return;
    }
    document.getElementById('browseButton')?.focus({ preventScroll: true });
}

function applyWorkflowStage(stage, sections, options = {}) {
    const { upload, files, processing, completion, info } = sections || {};
    const { scrollOnTransition = false, setupHandler = null } = options;

    if (stage === 'processing') {
        if (upload) upload.style.display = 'none';
        if (files) files.style.display = 'none';
        if (processing) processing.style.display = 'flex';
        if (completion) completion.style.display = 'none';
        if (info) info.style.display = 'none';
        if (scrollOnTransition && processing) {
            processing.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        moveFocusForStage(stage, sections);
        return;
    }

    if (stage === 'completed') {
        if (upload) upload.style.display = 'none';
        if (files) files.style.display = 'none';
        if (processing) processing.style.display = 'none';
        if (completion) completion.style.display = 'block';
        if (info) info.style.display = 'none';
        if (scrollOnTransition && completion) {
            completion.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        moveFocusForStage(stage, sections);
        return;
    }

    // setup
    if (processing) processing.style.display = 'none';
    if (completion) completion.style.display = 'none';
    if (info) info.style.display = 'block';
    if (typeof setupHandler === 'function') {
        try {
            setupHandler(sections);
        } catch (err) {
            console.error('setupHandler threw:', err);
        }
    }

    // After the handler, so it reflects the sections the tool actually showed.
    moveFocusForStage(stage, sections);
}

// ============================================
// PROGRESS DISPLAY
// ============================================

/**
 * Update the progress display. Element refs are passed in so each tool can wire
 * its own element IDs (e.g., compress uses 'compressionStats', others use 'processingStats').
 *
 * @param {Object} elements - { currentEl, totalEl, messageEl, statsEl, infoEl }
 * @param {number|string} current - Current item number
 * @param {number|string} total - Total item count
 * @param {string} [message] - Progress message
 * @param {string} [stats] - Secondary stats line
 */
function updateProgressUI(elements, current, total, message, stats = '') {
    const { currentEl, totalEl, messageEl, statsEl, infoEl } = elements || {};
    if (currentEl) currentEl.textContent = String(current);
    if (totalEl) totalEl.textContent = String(total);
    if (messageEl && message != null) messageEl.textContent = message;
    if (statsEl) statsEl.textContent = stats;
    if (infoEl) infoEl.style.display = 'block';
}

/**
 * Reset the progress display to default labels and hide the progress info row.
 *
 * @param {Object} elements - { titleEl, messageEl, statsEl, infoEl }
 * @param {Object} [defaults] - { title, message }
 */
function resetProgressUI(elements, defaults = {}) {
    const { titleEl, messageEl, statsEl, infoEl } = elements || {};
    if (titleEl && defaults.title != null) titleEl.textContent = defaults.title;
    if (messageEl && defaults.message != null) messageEl.textContent = defaults.message;
    if (statsEl) statsEl.textContent = '';
    if (infoEl) infoEl.style.display = 'none';
}

// ============================================
// INITIALIZATION
// ============================================

try {
    console.log('✅ Shared Utilities Module Loaded');
} catch (error) {
    console.error('Error during shared utilities initialization:', error);
}
