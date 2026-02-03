// ============================================
// SPLIT PDF - ENHANCED ERROR HANDLING
// SecureKit - Client-Side PDF Processing
// ============================================

const { PDFDocument } = PDFLib;

// State
let selectedFile = null;
let pdfDoc = null;
let ranges = [];
let isProcessing = false;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const uploadSection = document.getElementById('uploadSection');
const fileSection = document.getElementById('fileSection');
const fileDisplay = document.getElementById('fileDisplay');
const removeButton = document.getElementById('removeButton');
const cancelButton = document.getElementById('cancelButton');
const splitButton = document.getElementById('splitButton');
const processingSection = document.getElementById('processingSection');
const baseFilename = document.getElementById('baseFilename');
const accordionToggle = document.getElementById('accordionToggle');
const accordionContent = document.getElementById('accordionContent');
const customPages = document.getElementById('customPages');
const fixedPages = document.getElementById('fixedPages');
const addRangeButton = document.getElementById('addRangeButton');
const rangesList = document.getElementById('rangesList');

// ============================================
// INITIALIZATION
// ============================================

// Set default filename with error handling
function getDefaultFilename() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `SplitPDF_${year}${month}${day}`;
    } catch (error) {
        console.error('Error generating default filename:', error);
        return 'SplitPDF';
    }
}

try {
    baseFilename.value = getDefaultFilename();
} catch (error) {
    console.error('Error setting default filename:', error);
}

// Accordion Toggle with error handling
if (accordionToggle && accordionContent) {
    accordionToggle.addEventListener('click', () => {
        try {
            accordionToggle.classList.toggle('active');
            accordionContent.classList.toggle('active');
        } catch (error) {
            console.error('Error toggling accordion:', error);
        }
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

try {
    browseButton?.addEventListener('click', () => {
        try {
            fileInput.click();
        } catch (error) {
            console.error('Error opening file dialog:', error);
            showErrorMessage('Unable to open file selection dialog. Please try again.');
        }
    });

    uploadArea?.addEventListener('click', () => {
        try {
            fileInput.click();
        } catch (error) {
            console.error('Error in upload area click:', error);
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    removeButton?.addEventListener('click', removeFile);
    cancelButton?.addEventListener('click', removeFile);
    splitButton?.addEventListener('click', splitPDF);

    // Radio button change handlers
    const radioButtons = document.querySelectorAll('input[name="splitMode"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', handleRadioChange);
    });

    // Add range button
    addRangeButton?.addEventListener('click', addRangeInput);

    // Initialize with one range
    addRangeInput();

} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the application. Please refresh the page.');
}

function handleRadioChange(e) {
    try {
        // Hide all input wrappers
        document.querySelectorAll('.radio-input-wrapper').forEach(wrapper => {
            wrapper.style.display = 'none';
        });

        // Show the selected one
        const selectedRadio = e.target;
        const wrapper = selectedRadio.parentElement.querySelector('.radio-input-wrapper');
        if (wrapper) {
            wrapper.style.display = 'block';
        }
    } catch (error) {
        console.error('Error in handleRadioChange:', error);
    }
}

// Drag and Drop with error handling
try {
    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea?.addEventListener('drop', (e) => {
        try {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files).filter(file => {
                if (file.type === 'application/pdf') {
                    return true;
                }
                console.warn('Skipping non-PDF file:', file.name);
                return false;
            });

            if (files.length === 0) {
                showWarningMessage('Please drop a PDF file only.');
                return;
            }

            if (files.length > 1) {
                showWarningMessage('Please drop only one PDF file at a time. Using the first file.');
            }

            if (files.length > 0) {
                handleFileSelect({ target: { files: [files[0]] } });
            }
        } catch (error) {
            console.error('Error handling file drop:', error);
            showErrorMessage('Failed to process dropped file. Please try using the file selector instead.');
        }
    });
} catch (error) {
    console.error('Error setting up drag and drop:', error);
}

// ============================================
// FILE HANDLING WITH ENHANCED ERROR HANDLING
// ============================================

// Handle File Selection
function handleFileSelect(e) {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        if (!e || !e.target || !e.target.files) {
            console.error('Invalid event object in handleFileSelect');
            return;
        }

        const file = e.target.files[0];
        if (!file) {
            return;
        }

        // Validate it's a PDF
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showErrorMessage(`"${file.name}" is not a PDF file. Please select a valid PDF.`);
            fileInput.value = '';
            return;
        }

        // Validate file size
        const validation = validateFileSize(file, true);

        if (!validation.valid) {
            showErrorMessage(validation.error);
            fileInput.value = '';
            return;
        }

        if (validation.warning) {
            showWarningMessage(validation.warning);
        }

        handleFile(file);
        fileInput.value = '';

    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        showErrorMessage('An error occurred while selecting the file. Please try again.');
        fileInput.value = '';
    }
}

// Handle File with comprehensive error handling
async function handleFile(file) {
    try {
        if (!file || !(file instanceof File)) {
            showErrorMessage('Invalid file provided.');
            return;
        }

        // Check memory before loading
        const estimatedMemory = estimateMemoryUsage(file.size);
        const memoryCheck = checkAvailableMemory(estimatedMemory);

        if (!memoryCheck.hasEnough) {
            showErrorMessage(memoryCheck.warning || 'Insufficient memory to process this file.\nPlease close other tabs and try again.');
            return;
        } else if (memoryCheck.warning) {
            showWarningMessage(memoryCheck.warning);
        }

        // Load the PDF
        const arrayBuffer = await file.arrayBuffer();

        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            showErrorMessage('File appears to be empty or corrupted.');
            return;
        }

        // Try to load as PDF
        try {
            pdfDoc = await PDFDocument.load(arrayBuffer, {
                ignoreEncryption: false
            });
        } catch (loadError) {
            console.error('PDF loading error:', loadError);

            let errorMsg = 'Failed to load PDF file.';
            if (loadError.message.includes('encrypted') || loadError.message.includes('password')) {
                errorMsg = 'This PDF is password-protected and cannot be processed.\nPlease remove the password protection first.';
            } else if (loadError.message.includes('Invalid') || loadError.message.includes('parse')) {
                errorMsg = 'This file appears to be corrupted or is not a valid PDF.\nPlease try a different file.';
            } else {
                errorMsg = `Error loading PDF: ${loadError.message.substring(0, 100)}`;
            }

            showErrorMessage(errorMsg);
            return;
        }

        const pageCount = pdfDoc.getPageCount();

        if (pageCount === 0) {
            showErrorMessage('This PDF has no pages.');
            pdfDoc = null;
            return;
        }

        selectedFile = {
            file: file,
            name: file.name,
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            pageCount: pageCount
        };

        // Add size warning if applicable
        const validation = validateFileSize(file, false);
        if (validation.warning) {
            selectedFile.sizeWarning = validation.warning;
        }

        updateUI();

    } catch (error) {
        console.error('Error loading PDF:', error);

        let errorMsg = 'An error occurred while loading the PDF.';
        if (error.name === 'QuotaExceededError') {
            errorMsg = 'Not enough memory to load this file. Please close other tabs and try again.';
        } else if (error.message) {
            errorMsg = `Error: ${error.message.substring(0, 100)}`;
        }

        showErrorMessage(errorMsg);
        pdfDoc = null;
        selectedFile = null;
    }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update UI with error handling
function updateUI() {
    try {
        if (selectedFile) {
            uploadSection.style.display = 'none';
            fileSection.style.display = 'block';
            renderFileDisplay();
        } else {
            uploadSection.style.display = 'block';
            fileSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating UI:', error);
        showErrorMessage('UI update failed. Please refresh the page.');
    }
}

// Render File Display with error handling
function renderFileDisplay() {
    try {
        if (!fileDisplay || !selectedFile) {
            console.error('Missing fileDisplay element or selectedFile');
            return;
        }

        fileDisplay.innerHTML = `
            <div class="file-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
                    <path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
            <div class="file-details">
                <div class="file-name">${escapeHtml(selectedFile.name)}</div>
                <div class="file-metadata">${selectedFile.size} • ${selectedFile.pageCount} pages</div>
            </div>
        `;

        // Add size warning if exists
        if (selectedFile.sizeWarning) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'file-size-warning';
            warningDiv.style.cssText = `
                width: 100%;
                padding: 12px;
                margin-top: 16px;
                background-color: rgba(255, 152, 0, 0.1);
                border: 1px solid #ff9800;
                border-radius: 8px;
                color: #ff9800;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            warningDiv.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>${escapeHtml(selectedFile.sizeWarning)}</span>
            `;
            fileDisplay.appendChild(warningDiv);
        }

    } catch (error) {
        console.error('Error rendering file display:', error);
        showErrorMessage('Failed to display file information.');
    }
}

// ============================================
// RANGE MANAGEMENT
// ============================================

// Add Range Input with error handling
function addRangeInput() {
    try {
        if (!rangesList) {
            console.error('Ranges list element not found');
            return;
        }

        const rangeId = Date.now() + Math.random();
        const rangeItem = document.createElement('div');
        rangeItem.className = 'range-item';
        rangeItem.dataset.rangeId = rangeId;

        rangeItem.innerHTML = `
            <input type="text" class="split-input range-input" placeholder="e.g., 1-5" data-range-id="${rangeId}">
            <button class="remove-range-button" onclick="removeRange('${rangeId}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;

        rangesList.appendChild(rangeItem);
        ranges.push(rangeId);

    } catch (error) {
        console.error('Error adding range input:', error);
    }
}

// Remove Range Input with error handling
function removeRange(rangeId) {
    try {
        if (ranges.length > 1) {
            const rangeItem = document.querySelector(`[data-range-id="${rangeId}"]`);
            if (rangeItem) {
                rangeItem.remove();
                ranges = ranges.filter(id => id != rangeId);
            }
        } else {
            showWarningMessage('At least one range is required.');
        }
    } catch (error) {
        console.error('Error removing range:', error);
    }
}

// ============================================
// PAGE SELECTION PARSING
// ============================================

function parsePageSelection(selection, totalPages) {
    try {
        if (!selection || typeof selection !== 'string') {
            throw new Error('Invalid page selection');
        }

        const pages = new Set();
        const parts = selection.split(',').map(s => s.trim()).filter(s => s);

        if (parts.length === 0) {
            throw new Error('Empty page selection');
        }

        for (const part of parts) {
            if (part.includes('-')) {
                // Range like "2-5"
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));

                if (isNaN(start) || isNaN(end)) {
                    throw new Error(`Invalid range format: "${part}". Use numbers only (e.g., "1-5").`);
                }

                if (start < 1 || end > totalPages) {
                    throw new Error(`Range "${part}" is out of bounds. PDF has ${totalPages} pages.`);
                }

                if (start > end) {
                    throw new Error(`Invalid range "${part}". Start page (${start}) cannot be greater than end page (${end}).`);
                }

                for (let i = start; i <= end; i++) {
                    pages.add(i - 1); // Convert to 0-indexed
                }
            } else {
                // Single page like "7"
                const page = parseInt(part);

                if (isNaN(page)) {
                    throw new Error(`Invalid page number: "${part}". Use numbers only.`);
                }

                if (page < 1 || page > totalPages) {
                    throw new Error(`Page ${page} is out of bounds. PDF has ${totalPages} pages (1-${totalPages}).`);
                }

                pages.add(page - 1); // Convert to 0-indexed
            }
        }

        if (pages.size === 0) {
            throw new Error('No valid pages selected.');
        }

        return Array.from(pages).sort((a, b) => a - b);

    } catch (error) {
        // Re-throw with context
        throw error;
    }
}

// ============================================
// FILE OPERATIONS
// ============================================

// Remove File with error handling
function removeFile() {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        selectedFile = null;
        pdfDoc = null;
        updateUI();
        clearAllMessages();

    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please refresh the page.');
    }
}

// ============================================
// SPLIT PDF WITH COMPREHENSIVE ERROR HANDLING
// ============================================

async function splitPDF() {
    // Prevent multiple simultaneous splits
    if (isProcessing) {
        showWarningMessage('A split operation is already in progress. Please wait.');
        return;
    }

    try {
        // Validate we have a file
        if (!selectedFile || !pdfDoc) {
            showErrorMessage('Please select a PDF file first.');
            return;
        }

        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
        if (!splitMode) {
            showErrorMessage('Please select a split mode.');
            return;
        }

        const totalPages = selectedFile.pageCount;

        // Validate filename
        let filename = baseFilename.value.trim();
        if (!filename) {
            filename = getDefaultFilename();
        }

        // Sanitize filename
        filename = sanitizeFilename(filename);
        if (!filename) {
            showWarningMessage('Invalid filename. Using default name.');
            filename = getDefaultFilename();
        }

        let splitRanges = [];
        const errors = [];

        try {
            if (splitMode === 'all') {
                // Split each page
                for (let i = 0; i < totalPages; i++) {
                    splitRanges.push([i]);
                }
            } else if (splitMode === 'custom') {
                const customPagesValue = customPages?.value.trim();
                if (!customPagesValue) {
                    showErrorMessage('Please enter pages to extract (e.g., "1-3,5,7").');
                    return;
                }

                try {
                    const pageIndices = parsePageSelection(customPagesValue, totalPages);
                    for (const pageIndex of pageIndices) {
                        splitRanges.push([pageIndex]);
                    }
                } catch (parseError) {
                    showErrorMessage(parseError.message);
                    return;
                }
            } else if (splitMode === 'ranges') {
                const rangeInputs = document.querySelectorAll('.range-input');

                rangeInputs.forEach((input, index) => {
                    const rangeValue = input.value.trim();
                    if (rangeValue) {
                        try {
                            const pageIndices = parsePageSelection(rangeValue, totalPages);
                            splitRanges.push(pageIndices);
                        } catch (parseError) {
                            errors.push(`Range ${index + 1}: ${parseError.message}`);
                        }
                    }
                });

                if (errors.length > 0) {
                    showErrorMessage('Invalid ranges:\n' + errors.join('\n'));
                    return;
                }

                if (splitRanges.length === 0) {
                    showErrorMessage('Please enter at least one page range.');
                    return;
                }
            } else if (splitMode === 'fixed') {
                const fixedPagesValue = parseInt(fixedPages?.value);

                if (isNaN(fixedPagesValue) || fixedPagesValue < 1) {
                    showErrorMessage('Please enter a valid number of pages per split (minimum 1).');
                    return;
                }

                if (fixedPagesValue > totalPages) {
                    showErrorMessage(`Pages per split (${fixedPagesValue}) cannot exceed total pages (${totalPages}).`);
                    return;
                }

                for (let i = 0; i < totalPages; i += fixedPagesValue) {
                    const range = [];
                    for (let j = i; j < Math.min(i + fixedPagesValue, totalPages); j++) {
                        range.push(j);
                    }
                    splitRanges.push(range);
                }
            }
        } catch (error) {
            console.error('Error processing split configuration:', error);
            showErrorMessage(`Error in page selection: ${error.message}`);
            return;
        }

        if (splitRanges.length === 0) {
            showErrorMessage('No pages selected for splitting.');
            return;
        }

        // Warn if creating many files
        if (splitRanges.length > 100) {
            showWarningMessage(`Warning: This will create ${splitRanges.length} files. This may take a while.`, 3000);
        }

        // Estimate output size and check storage
        const estimatedOutputSize = selectedFile.sizeBytes * splitRanges.length * 0.15; // Rough estimate
        const storageCheck = await checkStorageQuota(estimatedOutputSize);
        if (!storageCheck.hasSpace) {
            showErrorMessage(storageCheck.error || 'Insufficient storage space for output files. Please free up some space.');
            return;
        }

        // Set processing flag and show processing UI
        isProcessing = true;
        fileSection.style.display = 'none';
        processingSection.style.display = 'block';

        // Process splits
        const failedSplits = [];
        let successCount = 0;

        for (let i = 0; i < splitRanges.length; i++) {
            try {
                const range = splitRanges[i];

                if (!range || range.length === 0) {
                    failedSplits.push({ index: i + 1, error: 'Empty range' });
                    continue;
                }

                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(pdfDoc, range);
                copiedPages.forEach(page => newPdf.addPage(page));

                const pdfBytes = await newPdf.save();

                if (!pdfBytes || pdfBytes.length === 0) {
                    failedSplits.push({ index: i + 1, error: 'Empty output' });
                    continue;
                }

                // Generate filename
                const outputFilename = `${filename}_${i + 1}.pdf`;
                downloadFile(pdfBytes, outputFilename);
                successCount++;

                // Small delay between downloads to prevent browser blocking
                if (i < splitRanges.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

            } catch (error) {
                console.error(`Error creating split ${i + 1}:`, error);
                failedSplits.push({ index: i + 1, error: error.message.substring(0, 50) });
            }
        }

        // Reset UI
        setTimeout(() => {
            try {
                processingSection.style.display = 'none';
                fileSection.style.display = 'block';
                isProcessing = false;

                // Show result message
                if (successCount === 0) {
                    showErrorMessage('Failed to create any split files. Please try again.');
                } else if (failedSplits.length > 0) {
                    showWarningMessage(
                        `Created ${successCount} out of ${splitRanges.length} files successfully.\n${failedSplits.length} split(s) failed.`,
                        5000
                    );
                } else {
                    showSuccessMessage(`PDF split successfully into ${successCount} file${successCount > 1 ? 's' : ''}!`);
                }

            } catch (resetError) {
                console.error('Error resetting UI:', resetError);
                isProcessing = false;
            }
        }, 500);

    } catch (error) {
        console.error('Error splitting PDF:', error);

        // Reset processing flag
        isProcessing = false;

        // Reset UI
        processingSection.style.display = 'none';
        fileSection.style.display = 'block';

        // Show error message
        let errorMsg = 'An error occurred while splitting the PDF.';
        if (error.name === 'QuotaExceededError') {
            errorMsg = 'Not enough storage space. Please free up some space and try again.';
        } else if (error.message) {
            errorMsg = error.message;
        }

        showErrorMessage(errorMsg);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Download File with error handling
function downloadFile(data, filename) {
    try {
        if (!data || data.length === 0) {
            throw new Error('No data to download');
        }

        if (!filename || typeof filename !== 'string') {
            filename = 'download.pdf';
        }

        const blob = new Blob([data], { type: 'application/pdf' });

        if (blob.size === 0) {
            throw new Error('Generated file is empty');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            try {
                URL.revokeObjectURL(url);
            } catch (revokeError) {
                console.warn('Failed to revoke object URL:', revokeError);
            }
        }, 100);

    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

// Sanitize Filename
function sanitizeFilename(filename) {
    try {
        if (!filename || typeof filename !== 'string') {
            return '';
        }

        // Remove .pdf extension if present
        let name = filename.replace(/\.pdf$/i, '');

        // Replace invalid characters with underscore
        name = name.replace(/[^a-z0-9_\-\s]/gi, '_');

        // Replace multiple spaces/underscores with single
        name = name.replace(/[_\s]+/g, '_');

        // Limit length to 200 characters
        name = name.substring(0, 200);

        // Remove leading/trailing spaces and underscores
        name = name.replace(/^[_\s]+|[_\s]+$/g, '');

        return name;

    } catch (error) {
        console.error('Error sanitizing filename:', error);
        return '';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    try {
        if (typeof text !== 'string') {
            text = String(text);
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;

    } catch (error) {
        console.error('Error escaping HTML:', error);
        return text;
    }
}

// Format File Size
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
        console.error('Error formatting file size:', error);
        return bytes + ' Bytes';
    }
}

// ============================================
// INITIALIZATION & ERROR DETECTION
// ============================================

// Check for browser compatibility on page load
window.addEventListener('DOMContentLoaded', () => {
    try {
        const compatibility = checkBrowserCompatibility();

        if (!compatibility.supported) {
            const errorMsg = `Your browser is missing required features: ${compatibility.missingFeatures.join(', ')}.\n\nPlease use a modern browser like Chrome, Firefox, Edge, or Safari.`;
            showErrorMessage(errorMsg);

            const toolPage = document.querySelector('.tool-page');
            if (toolPage) {
                toolPage.style.pointerEvents = 'none';
                toolPage.style.opacity = '0.5';
            }
        } else {
            console.log('✅ Browser compatibility check passed');
        }

        // Check if PDFLib is loaded
        if (typeof PDFLib === 'undefined' || !PDFLib.PDFDocument) {
            showErrorMessage('PDF library failed to load. Please refresh the page or check your internet connection.');

            const toolPage = document.querySelector('.tool-page');
            if (toolPage) {
                toolPage.style.pointerEvents = 'none';
                toolPage.style.opacity = '0.5';
            }
        }

    } catch (error) {
        console.error('Error during initialization:', error);
        showErrorMessage('Failed to initialize the application. Please refresh the page.');
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);

    if (event.message && event.message.includes('Script error')) {
        return;
    }

    if (isProcessing) {
        isProcessing = false;
        processingSection.style.display = 'none';
        fileSection.style.display = 'block';
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    if (isProcessing) {
        isProcessing = false;
        processingSection.style.display = 'none';
        fileSection.style.display = 'block';
        showErrorMessage('An error occurred during processing. Please try again.');
    }
});

console.log('✅ Split PDF module loaded successfully');
