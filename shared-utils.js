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
        dragOverClass = 'drag-over'
    } = options;

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
                    if (file.type === fileType) {
                        return true;
                    }
                    console.warn('Skipping non-PDF file:', file.name);
                    return false;
                });

                if (files.length === 0) {
                    showWarningMessage('Please drop PDF files only.');
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
        if (processing) {
            if (button) {
                button.disabled = true;
                button.textContent = processingText || 'Processing...';
            }
            if (processingSection) {
                processingSection.style.display = 'flex';
            }
        } else {
            if (button) {
                button.disabled = false;
                button.textContent = originalText || 'Process';
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
// INITIALIZATION
// ============================================

try {
    console.log('✅ Shared Utilities Module Loaded');
    console.log('   Available functions:');
    console.log('   • formatFileSize()');
    console.log('   • getDefaultFilename()');
    console.log('   • downloadPDF()');
    console.log('   • downloadMultiplePDFs()');
    console.log('   • setupAccordion()');
    console.log('   • setupDragAndDrop()');
    console.log('   • setupRadioButtons()');
    console.log('   • handleRadioToggle()');
    console.log('   • isPDF()');
    console.log('   • loadPDFWithValidation()');
    console.log('   • parsePageSelection()');
    console.log('   • setProcessingState()');
} catch (error) {
    console.error('Error during shared utilities initialization:', error);
}
