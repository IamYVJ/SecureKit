// ============================================
// SPLIT PDF
// SecureKit - Client-Side PDF Processing
// ============================================

const { PDFDocument } = PDFLib;

let selectedFile = null;
let pdfDoc = null;
let isProcessing = false;
let workflowStage = 'setup';
let lastSplitResult = null;

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
const processingTitle = document.getElementById('processingTitle');
const processingMessage = document.getElementById('processingMessage');
const progressInfo = document.getElementById('progressInfo');
const currentFile = document.getElementById('currentFile');
const totalFiles = document.getElementById('totalFiles');
const processingStats = document.getElementById('processingStats');
const completionSection = document.getElementById('completionSection');
const completionTitle = document.getElementById('completionTitle');
const completionSummary = document.getElementById('completionSummary');
const completionStats = document.getElementById('completionStats');
const completionDetails = document.getElementById('completionDetails');
const saveButton = document.getElementById('saveButton');
const anotherButton = document.getElementById('anotherButton');
const infoSection = document.querySelector('.info-section');
const baseFilename = document.getElementById('baseFilename');
const downloadModeSelect = document.getElementById('downloadMode');
const accordionToggle = document.getElementById('accordionToggle');
const accordionContent = document.getElementById('accordionContent');
const customPages = document.getElementById('customPages');
const fixedPages = document.getElementById('fixedPages');
const addRangeButton = document.getElementById('addRangeButton');
const rangesList = document.getElementById('rangesList');

try {
    baseFilename.value = getDefaultFilename('SplitPDF');
} catch (error) {
    console.error('Error setting default filename:', error);
}

setupAccordion(accordionToggle, accordionContent);

try {
    browseButton?.addEventListener('click', () => fileInput.click());

    uploadArea?.addEventListener('click', (e) => {
        if (!browseButton?.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    removeButton?.addEventListener('click', removeFile);
    cancelButton?.addEventListener('click', removeFile);
    splitButton?.addEventListener('click', splitPDF);
    saveButton?.addEventListener('click', saveSplitResults);
    anotherButton?.addEventListener('click', startAnotherSplit);
    addRangeButton?.addEventListener('click', addRangeInput);

    setupRadioButtons('splitMode', (e) => {
        handleRadioToggle(e, '.radio-input-wrapper');
    });

    addRangeInput();
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the application. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => {
    if (files.length > 1) {
        showWarningMessage('Please drop only one PDF file at a time. Using the first file.');
    }
    handleFileSelect({ target: { files: [files[0]] } });
}, { allowMultiple: false });

function handleFileSelect(e) {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        const file = e?.target?.files?.[0];
        if (!file) {
            return;
        }

        if (!isPDF(file)) {
            showErrorMessage(`"${file.name}" is not a PDF file. Please select a valid PDF.`);
            fileInput.value = '';
            return;
        }

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
        const estimatedMemory = estimateMemoryUsage(file.size);
        const memoryCheck = checkAvailableMemory(estimatedMemory);

        if (!memoryCheck.hasEnough) {
            showErrorMessage(memoryCheck.warning || 'Insufficient memory to process this file.');
            return;
        }

        if (memoryCheck.warning) {
            showWarningMessage(memoryCheck.warning);
        }

        const result = await loadPDFWithValidation(file);
        if (result.error) {
            showErrorMessage(result.error);
            return;
        }

        pdfDoc = result.pdfDoc;
        selectedFile = {
            file,
            name: file.name,
            size: formatFileSize(file.size),
            sizeBytes: file.size,
            pageCount: result.pageCount
        };

        const validation = validateFileSize(file, false);
        if (validation.warning) {
            selectedFile.sizeWarning = validation.warning;
        }

        setWorkflowStage('setup');
    } catch (error) {
        console.error('Error loading PDF:', error);
        showErrorMessage(error.message || 'An error occurred while loading the PDF.');
        pdfDoc = null;
        selectedFile = null;
        setWorkflowStage('setup');
    }
}

const sections = {
    upload: uploadSection,
    files: fileSection,
    processing: processingSection,
    completion: completionSection,
    info: infoSection
};

const progressElements = {
    titleEl: processingTitle,
    messageEl: processingMessage,
    statsEl: processingStats,
    currentEl: currentFile,
    totalEl: totalFiles,
    infoEl: progressInfo
};

function setupHandler() {
    if (selectedFile) {
        uploadSection.style.display = 'none';
        fileSection.style.display = 'block';
        renderFileDisplay();
    } else {
        uploadSection.style.display = 'block';
        fileSection.style.display = 'none';
    }
}

function updateUI() {
    applyWorkflowStage(workflowStage, sections, { setupHandler });
}

function setWorkflowStage(stage) {
    workflowStage = stage;
    applyWorkflowStage(stage, sections, { setupHandler, scrollOnTransition: true });
}

function renderFileDisplay() {
    if (!fileDisplay || !selectedFile) {
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
                ${selectedFile.size} - ${selectedFile.pageCount} page${selectedFile.pageCount !== 1 ? 's' : ''}
            </div>
        </div>
    `;
}

function removeFile() {
    selectedFile = null;
    pdfDoc = null;
    lastSplitResult = null;
    setWorkflowStage('setup');
}

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

        rangeItem.querySelector('.remove-range')?.addEventListener('click', () => {
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

function updateProgress(fileIndex, totalCount, message, stats = '') {
    if (processingTitle) {
        processingTitle.textContent = `Splitting ${fileIndex} of ${totalCount}`;
    }
    updateProgressUI(progressElements, fileIndex, totalCount, message, stats);
}

function resetProgress() {
    resetProgressUI(progressElements, {
        title: 'Splitting PDF...',
        message: 'Please wait while we process your file'
    });
}

function renderCompletionStats(items) {
    completionStats.innerHTML = items.map((item) => `
        <div class="completion-stat">
            <span class="completion-stat-label">${escapeHtml(item.label)}</span>
            <span class="completion-stat-value">${escapeHtml(item.value)}</span>
        </div>
    `).join('');
}

function renderCompletionDetails(notes, items) {
    const noteMarkup = notes.map((note) => `<div class="completion-note">${note}</div>`).join('');
    const listMarkup = items.length > 0 ? `
        <div class="completion-list">
            ${items.map((item) => `
                <div class="completion-list-item">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.meta)}</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    completionDetails.innerHTML = noteMarkup + listMarkup;
}

function showSplitCompletion(result) {
    lastSplitResult = result;

    completionTitle.textContent = 'Split Files Ready';
    completionSummary.textContent = `Created ${result.files.length} PDF file${result.files.length !== 1 ? 's' : ''} from ${result.sourceName}.`;

    renderCompletionStats([
        { label: 'Source File', value: result.sourceName },
        { label: 'Pages in Source', value: String(result.sourcePages) },
        { label: 'Files Created', value: String(result.files.length) },
        { label: 'Output Size', value: formatFileSize(result.totalBytes) }
    ]);

    const notes = [
        `<strong>Done:</strong> Your PDF was split using the <strong>${escapeHtml(result.modeLabel)}</strong> method.`
    ];

    if (result.failedSplits.length > 0) {
        notes.push(`<strong>Attention:</strong> ${result.failedSplits.length} split${result.failedSplits.length !== 1 ? 's were' : ' was'} not created.`);
    }

    renderCompletionDetails(
        notes,
        [
            ...result.files.slice(0, 12).map((item) => ({
                title: `${item.filename}.pdf`,
                meta: formatFileSize(item.bytes.length)
            })),
            ...result.failedSplits.map((item) => ({
                title: `${item.name} (skipped)`,
                meta: item.error
            }))
        ]
    );

    setWorkflowStage('completed');
}

async function saveSplitResults() {
    if (!lastSplitResult) {
        showWarningMessage('No split files are ready to save yet.');
        return;
    }

    const mode = downloadModeSelect?.value || 'zip';

    try {
        if (mode === 'zip') {
            const archiveBase = sanitizeFilename(baseFilename?.value?.trim() || '')
                || getDefaultFilename('SplitPDF');
            const items = lastSplitResult.files.map((f) => ({
                filename: f.filename.endsWith('.pdf') ? f.filename : `${f.filename}.pdf`,
                bytes: f.bytes
            }));
            const result = await downloadAsZip(items, archiveBase);
            if (result.failed > 0) {
                showWarningMessage(`Archive ready, but ${result.failed} file${result.failed !== 1 ? 's' : ''} could not be added.`);
            }
        } else {
            const results = await downloadMultiplePDFs(lastSplitResult.files, 120);
            if (results.failed > 0) {
                showWarningMessage(`Started saving split files, but ${results.failed} download${results.failed !== 1 ? 's' : ''} failed.`);
            }
        }
    } catch (error) {
        console.error('Error saving split files:', error);
        showErrorMessage(error.message || 'Failed to save the split PDFs.');
    }
}

function startAnotherSplit() {
    lastSplitResult = null;
    selectedFile = null;
    pdfDoc = null;
    baseFilename.value = getDefaultFilename('SplitPDF');
    customPages.value = '';
    fixedPages.value = '';
    setWorkflowStage('setup');
}

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
        setProcessingState(true, splitButton, null, 'Split PDF', 'Splitting...');
        resetProgress();
        setWorkflowStage('processing');

        let splits = [];

        if (splitMode === 'all') {
            for (let i = 0; i < selectedFile.pageCount; i++) {
                splits.push({ pages: [i], name: `page_${i + 1}` });
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

            splits.push({ pages: result.pages.map((p) => p - 1), name: 'custom_pages' });
        } else if (splitMode === 'ranges') {
            const rangeInputs = document.querySelectorAll('.range-input');
            const errors = [];

            rangeInputs.forEach((input, idx) => {
                const value = input.value.trim();
                if (!value) {
                    return;
                }

                const result = parsePageSelection(value, selectedFile.pageCount);
                if (result.error) {
                    errors.push(`Range ${idx + 1}: ${result.error}`);
                } else if (result.pages.length > 0) {
                    splits.push({
                        pages: result.pages.map((p) => p - 1),
                        name: `range_${idx + 1}`
                    });
                }
            });

            if (errors.length > 0) {
                throw new Error('Invalid ranges:\n' + errors.join('\n'));
            }

            if (splits.length === 0) {
                throw new Error('Please enter at least one valid range.');
            }
        } else if (splitMode === 'fixed') {
            const pagesPerSplit = parseInt(fixedPages?.value, 10);
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
                    pages,
                    name: `part_${Math.floor(i / pagesPerSplit) + 1}`
                });
            }
        }

        if (splits.length === 0) {
            throw new Error('No splits to create. Please check your settings.');
        }

        if (splits.length > 100) {
            const confirmed = confirm(`This will create ${splits.length} PDF files. This may take a while. Continue?`);
            if (!confirmed) {
                throw new Error('Split operation cancelled by user.');
            }
        }

        const pdfDataArray = [];
        const failedSplits = [];
        const modeLabels = {
            all: 'Split All Pages',
            custom: 'Custom Pages',
            ranges: 'Page Ranges',
            fixed: 'Fixed Pages'
        };

        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];

            try {
                updateProgress(
                    i + 1,
                    splits.length,
                    `Creating ${split.name.replace(/_/g, ' ')}`,
                    `${split.pages.length} page${split.pages.length !== 1 ? 's' : ''}`
                );

                const newPdf = await PDFDocument.create();
                const copiedPages = await newPdf.copyPages(pdfDoc, split.pages);
                copiedPages.forEach((page) => newPdf.addPage(page));

                const pdfBytes = await newPdf.save();
                if (!pdfBytes || pdfBytes.length === 0) {
                    failedSplits.push({ name: split.name, error: 'Empty output' });
                    continue;
                }

                const baseNameValue = baseFilename.value.trim() || 'SplitPDF';
                pdfDataArray.push({
                    bytes: pdfBytes,
                    filename: `${baseNameValue}_${split.name}`
                });
            } catch (error) {
                console.error('Error creating split:', split.name, error);
                failedSplits.push({ name: split.name, error: 'Failed to create' });
            }
        }

        if (pdfDataArray.length === 0) {
            throw new Error('Failed to create any PDF splits. Please try again.');
        }

        showSplitCompletion({
            files: pdfDataArray,
            failedSplits,
            totalBytes: pdfDataArray.reduce((sum, item) => sum + item.bytes.length, 0),
            sourceName: selectedFile.name,
            sourcePages: selectedFile.pageCount,
            modeLabel: modeLabels[splitMode] || 'Selected Split Mode'
        });
    } catch (error) {
        console.error('Error splitting PDF:', error);
        showErrorMessage(error.message || 'An error occurred while splitting the PDF. Please try again.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        setProcessingState(false, splitButton, null, 'Split PDF', 'Splitting...');
        resetProgress();
    }
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, splitButton, null, 'Split PDF', 'Splitting...');
        resetProgress();
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, splitButton, null, 'Split PDF', 'Splitting...');
        resetProgress();
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});
