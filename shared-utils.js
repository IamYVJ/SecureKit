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
        toggleElement.addEventListener('click', () => {
            try {
                toggleElement.classList.toggle('active');
                contentElement.classList.toggle('active');
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
