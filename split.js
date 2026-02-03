// ============================================
// SPLIT PDF - WITH FILE SIZE VALIDATION
// SecureKit - Client-Side PDF Processing
// ============================================

const { PDFDocument } = PDFLib;

// State
let selectedFile = null;
let pdfDoc = null;
let ranges = [];

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

// Set default filename
function getDefaultFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `SplitPDF_${year}${month}${day}`;
}

baseFilename.value = getDefaultFilename();

// Accordion Toggle
accordionToggle.addEventListener('click', () => {
    accordionToggle.classList.toggle('active');
    accordionContent.classList.toggle('active');
});

// ============================================
// EVENT LISTENERS
// ============================================

browseButton.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
removeButton.addEventListener('click', removeFile);
cancelButton.addEventListener('click', removeFile);
splitButton.addEventListener('click', splitPDF);

// Radio button change handlers
const radioButtons = document.querySelectorAll('input[name="splitMode"]');
radioButtons.forEach(radio => {
    radio.addEventListener('change', handleRadioChange);
});

// Add range button
addRangeButton.addEventListener('click', addRangeInput);

// Initialize with one range
addRangeInput();

function handleRadioChange(e) {
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
}

// Drag and Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
        handleFileSelect({ target: { files: [files[0]] } });
    }
});

// ============================================
// FILE HANDLING WITH VALIDATION
// ============================================

// Handle File Selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
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
    }
    fileInput.value = '';
}

// Handle File
async function handleFile(file) {
    // Check memory before loading
    const estimatedMemory = estimateMemoryUsage(file.size);
    const memoryCheck = checkAvailableMemory(estimatedMemory);

    if (!memoryCheck.hasEnough) {
        showErrorMessage(memoryCheck.warning || 'Insufficient memory to process this file.');
        return;
    } else if (memoryCheck.warning) {
        showWarningMessage(memoryCheck.warning);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

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
        showErrorMessage('Error loading PDF. Please ensure it\'s a valid PDF file.');
    }
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update UI
function updateUI() {
    if (selectedFile) {
        uploadSection.style.display = 'none';
        fileSection.style.display = 'block';
        renderFileDisplay();
    } else {
        uploadSection.style.display = 'block';
        fileSection.style.display = 'none';
    }
}

// Render File Display
function renderFileDisplay() {
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
            <span>${selectedFile.sizeWarning}</span>
        `;
        fileDisplay.appendChild(warningDiv);
    }
}

// ============================================
// RANGE MANAGEMENT
// ============================================

// Add Range Input
function addRangeInput() {
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
}

// Remove Range Input
function removeRange(rangeId) {
    if (ranges.length > 1) {
        const rangeItem = document.querySelector(`[data-range-id="${rangeId}"]`);
        if (rangeItem) {
            rangeItem.remove();
            ranges = ranges.filter(id => id !== rangeId);
        }
    }
}

// ============================================
// PAGE SELECTION PARSING
// ============================================

function parsePageSelection(selection, totalPages) {
    const pages = new Set();
    const parts = selection.split(',').map(s => s.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            // Range like "2-5"
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));

            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                throw new Error(`Invalid range: ${part}`);
            }

            for (let i = start; i <= end; i++) {
                pages.add(i - 1); // Convert to 0-indexed
            }
        } else {
            // Single page like "7"
            const page = parseInt(part);

            if (isNaN(page) || page < 1 || page > totalPages) {
                throw new Error(`Invalid page number: ${part}`);
            }

            pages.add(page - 1); // Convert to 0-indexed
        }
    }

    return Array.from(pages).sort((a, b) => a - b);
}

// ============================================
// FILE OPERATIONS
// ============================================

// Remove File
function removeFile() {
    selectedFile = null;
    pdfDoc = null;
    updateUI();
}

// ============================================
// SPLIT PDF WITH VALIDATION
// ============================================

async function splitPDF() {
    if (!selectedFile) {
        showErrorMessage('Please select a PDF file first');
        return;
    }

    const splitMode = document.querySelector('input[name="splitMode"]:checked').value;
    const totalPages = selectedFile.pageCount;

    // Validate filename
    let filename = baseFilename.value.trim();
    if (!filename) {
        filename = getDefaultFilename();
    }

    // Sanitize filename
    filename = sanitizeFilename(filename);

    let splitRanges = [];

    try {
        if (splitMode === 'all') {
            // Split each page
            for (let i = 0; i < totalPages; i++) {
                splitRanges.push([i]);
            }
        } else if (splitMode === 'custom') {
            const customPagesValue = customPages.value.trim();
            if (!customPagesValue) {
                showErrorMessage('Please enter pages to extract');
                return;
            }
            const pageIndices = parsePageSelection(customPagesValue, totalPages);
            for (const pageIndex of pageIndices) {
                splitRanges.push([pageIndex]);
            }
        } else if (splitMode === 'ranges') {
            const rangeInputs = document.querySelectorAll('.range-input');
            rangeInputs.forEach(input => {
                const rangeValue = input.value.trim();
                if (rangeValue) {
                    const pageIndices = parsePageSelection(rangeValue, totalPages);
                    splitRanges.push(pageIndices);
                }
            });

            if (splitRanges.length === 0) {
                showErrorMessage('Please enter at least one page range');
                return;
            }
        } else if (splitMode === 'fixed') {
            const fixedPagesValue = parseInt(fixedPages.value);

            if (isNaN(fixedPagesValue) || fixedPagesValue < 1) {
                showErrorMessage('Please enter a valid number of pages');
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
        showErrorMessage(`Error in page selection: ${error.message}`);
        return;
    }

    if (splitRanges.length === 0) {
        showErrorMessage('No pages selected for splitting');
        return;
    }

    // Estimate output size and check storage
    const estimatedOutputSize = selectedFile.sizeBytes * splitRanges.length * 0.15; // Rough estimate
    const storageCheck = await checkStorageQuota(estimatedOutputSize);
    if (!storageCheck.hasSpace) {
        showErrorMessage('Insufficient storage space for output files. Please free up some space.');
        return;
    }

    // Show processing
    fileSection.style.display = 'none';
    processingSection.style.display = 'block';

    try {
        // Process splits
        for (let i = 0; i < splitRanges.length; i++) {
            const range = splitRanges[i];
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, range);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();

            // Generate filename
            const outputFilename = `${filename}_${i + 1}.pdf`;
            downloadFile(pdfBytes, outputFilename);

            // Small delay between downloads to prevent browser blocking
            if (i < splitRanges.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Reset UI
        setTimeout(() => {
            processingSection.style.display = 'none';
            fileSection.style.display = 'block';

            // Show success message
            showSuccessMessage(splitRanges.length);
        }, 500);

    } catch (error) {
        console.error('Error splitting PDF:', error);
        showErrorMessage('An error occurred while splitting the PDF. Please try again.');
        processingSection.style.display = 'none';
        fileSection.style.display = 'block';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Download File
function downloadFile(data, filename) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Show Success Message
function showSuccessMessage(fileCount) {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #1a1a1a;
        border: 1px solid #2dff8f;
        border-radius: 12px;
        padding: 24px 32px;
        color: #f0f6fc;
        font-size: 18px;
        font-weight: 600;
        z-index: 1000;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        max-width: 90%;
    `;

    message.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color: #2dff8f; flex-shrink: 0;">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>PDF split successfully into ${fileCount} file${fileCount > 1 ? 's' : ''}!</span>
        </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.style.transition = 'opacity 0.3s ease';
        message.style.opacity = '0';
        setTimeout(() => document.body.removeChild(message), 300);
    }, 3000);
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Sanitize Filename
function sanitizeFilename(filename) {
    // Remove .pdf extension if present
    let name = filename.replace(/\.pdf$/i, '');

    // Replace invalid characters with underscore
    name = name.replace(/[^a-z0-9_\-\s]/gi, '_');

    // Limit length to 200 characters
    name = name.substring(0, 200);

    // Remove leading/trailing spaces and underscores
    name = name.replace(/^[_\s]+|[_\s]+$/g, '');

    // If empty after sanitization, use default
    if (!name) {
        name = getDefaultFilename();
    }

    return name;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize browser compatibility check on page load
window.addEventListener('DOMContentLoaded', () => {
    const compatibility = checkBrowserCompatibility();
    if (!compatibility.supported) {
        showErrorMessage(`Your browser is missing required features: ${compatibility.missingFeatures.join(', ')}. Please use a modern browser.`);
        document.querySelector('.tool-page').style.pointerEvents = 'none';
        document.querySelector('.tool-page').style.opacity = '0.5';
    }
});
