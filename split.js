// ============================================
// SPLIT PDF - ENHANCED & DEDUPLICATED
// SecureKit - Client-Side PDF Processing
// Uses shared-utils.js for common functions
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

try {
    // Set default filename using shared utility
    baseFilename.value = getDefaultFilename('SplitPDF');
} catch (error) {
    console.error('Error setting default filename:', error);
}

// Setup accordion using shared utility
setupAccordion(accordionToggle, accordionContent);

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
    addRangeButton?.addEventListener('click', addRangeInput);

    // Setup radio buttons using shared utility
    setupRadioButtons('splitMode', (e) => {
        handleRadioToggle(e, '.radio-input-wrapper');
    });

    // Initialize with one range
    addRangeInput();
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the application. Please refresh the page.');
}

// Setup drag and drop using shared utility
setupDragAndDrop(uploadArea, (files) => {
    if (files.length > 1) {
        showWarningMessage('Please drop only one PDF file at a time. Using the first file.');
    }
    handleFileSelect({ target: { files: [files[0]] } });
}, { allowMultiple: false });

// ============================================
// FILE HANDLING
// ============================================

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

        // Validate it's a PDF using shared utility
        if (!isPDF(file)) {
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

        // Load PDF using shared utility
        const result = await loadPDFWithValidation(file);

        if (result.error) {
            showErrorMessage(result.error);
            return;
        }

        pdfDoc = result.pdfDoc;

        selectedFile = {
            file: file,
            name: file.name,
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            pageCount: result.pageCount
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
// UI FUNCTIONS
// ============================================

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

function renderFileDisplay() {
    try {
        if (!fileDisplay || !selectedFile) {
            console.error('Missing fileDisplay element or selectedFile');
            return;
        }

        fileDisplay.innerHTML = `
            <div class="file-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
            </div>
            <div class="file-info-display">
                <div class="file-name-display">${escapeHtml(selectedFile.name)}</div>
                <div class="file-details-display">
                    ${selectedFile.size} • ${selectedFile.pageCount} page${selectedFile.pageCount !== 1 ? 's' : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error rendering file display:', error);
    }
}

function removeFile() {
    try {
        selectedFile = null;
        pdfDoc = null;
        updateUI();
    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please try again.');
    }
}

// ============================================
// RANGE INPUT MANAGEMENT
// ============================================

function addRangeInput() {
    try {
        const rangeItem = document.createElement('div');
        rangeItem.className = 'range-item';

        const rangeId = 'range_' + Date.now();

        rangeItem.innerHTML = `
            <input type="text" 
                   class="range-input" 
                   id="${rangeId}"
                   placeholder="e.g., 1-5 or 1,3,5">
            <button class="remove-range" title="Remove range">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        const removeBtn = rangeItem.querySelector('.remove-range');
        removeBtn.addEventListener('click', () => {
            if (rangesList.children.length > 1) {
                rangeItem.remove();
            } else {
                showWarningMessage('At least one range input is required.');
            }
        });

        rangesList.appendChild(rangeItem);
    } catch (error) {
        console.error('Error adding range input:', error);
    }
}

// ============================================
// SPLIT PDF FUNCTION
// ============================================

async function splitPDF() {
    if (isProcessing) {
        showWarningMessage('Split operation already in progress. Please wait.');
        return;
    }

    try {
        if (!selectedFile || !pdfDoc) {
            showErrorMessage('Please select a PDF file to split.');
            return;
        }

        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;

        if (!splitMode) {
            showErrorMessage('Please select a split mode.');
            return;
        }

        isProcessing = true;
        setProcessingState(true, splitButton, processingSection, 'Split PDF', 'Splitting...');

        let splits = [];

        // Determine splits based on mode
        if (splitMode === 'all') {
            for (let i = 0; i < selectedFile.pageCount; i++) {
                splits.push({
                    pages: [i],
                    name: `page_${i + 1}`
                });
            }
        } else if (splitMode === 'custom') {
            const customInput = customPages?.value.trim();

            if (!customInput) {
                throw new Error('Please enter page numbers for custom split.');
            }

            const result = parsePageSelection(customInput, selectedFile.pageCount);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.pages.length === 0) {
                throw new Error('No valid pages selected.');
            }

            splits.push({
                pages: result.pages.map(p => p - 1),
                name: 'custom_pages'
            });
        } else if (splitMode === 'ranges') {
            const rangeInputs = document.querySelectorAll('.range-input');
            const errors = [];

            rangeInputs.forEach((input, idx) => {
                const value = input.value.trim();
                if (value) {
                    const result = parsePageSelection(value, selectedFile.pageCount);

                    if (result.error) {
                        errors.push(`Range ${idx + 1}: ${result.error}`);
                    } else if (result.pages.length > 0) {
                        splits.push({
                            pages: result.pages.map(p => p - 1),
                            name: `range_${idx + 1}`
                        });
                    }
                }
            });

            if (errors.length > 0) {
                throw new Error('Invalid ranges:\n' + errors.join('\n'));
            }

            if (splits.length === 0) {
                throw new Error('Please enter at least one valid range.');
            }
        } else if (splitMode === 'fixed') {
            const pagesPerSplit = parseInt(fixedPages?.value);

            if (isNaN(pagesPerSplit) || pagesPerSplit < 1) {
                throw new Error('Please enter a valid number of pages per split (minimum 1).');
            }

            if (pagesPerSplit > selectedFile.pageCount) {
                throw new Error(`Pages per split (${pagesPerSplit}) cannot exceed total pages (${selectedFile.pageCount}).`);
            }

            for (let i = 0; i < selectedFile.pageCount; i += pagesPerSplit) {
                const endPage = Math.min(i + pagesPerSplit, selectedFile.pageCount);
                const pages = [];

                for (let j = i; j < endPage; j++) {
                    pages.push(j);
                }

                splits.push({
                    pages: pages,
                    name: `part_${Math.floor(i / pagesPerSplit) + 1}`
                });
            }
        }

        if (splits.length === 0) {
            throw new Error('No splits to create. Please check your settings.');
        }

        // Warn for large number of splits
        if (splits.length > 100) {
            const confirmed = confirm(`This will create ${splits.length} PDF files. This may take a while. Continue?`);
            if (!confirmed) {
                throw new Error('Split operation cancelled by user.');
            }
        }

        // Create PDF splits
        const pdfDataArray = [];
        const failedSplits = [];

        for (let i = 0; i < splits.length; i++) {
            try {
                const split = splits[i];
                const newPdf = await PDFDocument.create();

                const copiedPages = await newPdf.copyPages(pdfDoc, split.pages);
                copiedPages.forEach(page => newPdf.addPage(page));

                const pdfBytes = await newPdf.save();

                if (!pdfBytes || pdfBytes.length === 0) {
                    failedSplits.push({ name: split.name, error: 'Empty output' });
                    continue;
                }

                const baseNameValue = baseFilename.value.trim() || 'SplitPDF';
                const filename = `${baseNameValue}_${split.name}`;

                pdfDataArray.push({
                    bytes: pdfBytes,
                    filename: filename
                });
            } catch (error) {
                console.error('Error creating split:', splits[i].name, error);
                failedSplits.push({ name: splits[i].name, error: 'Failed to create' });
            }
        }

        if (pdfDataArray.length === 0) {
            throw new Error('Failed to create any PDF splits. Please try again.');
        }

        // Download all PDFs using shared utility
        const results = await downloadMultiplePDFs(pdfDataArray, 100);

        let successMsg = `Successfully created ${results.successful} out of ${splits.length} split${splits.length !== 1 ? 's' : ''}.`;

        if (results.failed > 0 || failedSplits.length > 0) {
            const allFailures = [
                ...failedSplits.map(f => `• ${f.name}: ${f.error}`),
                ...results.errors.map(e => `• ${e.filename}: ${e.error}`)
            ];

            if (allFailures.length > 0) {
                successMsg += '\n\nFailed splits:\n' + allFailures.join('\n');
            }

            showWarningMessage(successMsg);
        } else {
            showSuccessMessage(successMsg);
        }

        removeFile();

    } catch (error) {
        console.error('Error splitting PDF:', error);
        showErrorMessage(error.message || 'An error occurred while splitting the PDF. Please try again.');
    } finally {
        isProcessing = false;
        setProcessingState(false, splitButton, processingSection, 'Split PDF', 'Splitting...');
    }
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, splitButton, processingSection, 'Split PDF', 'Splitting...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, splitButton, processingSection, 'Split PDF', 'Splitting...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================

console.log('✅ Split PDF Module Loaded (Deduplicated)');
console.log('   Using shared-utils.js for common functions');
