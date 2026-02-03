// ============================================
// MERGE PDF - ENHANCED & DEDUPLICATED
// SecureKit - Client-Side PDF Processing
// Uses shared-utils.js for common functions
// ============================================

const { PDFDocument } = PDFLib;

// State
let selectedFiles = [];
let draggedElement = null;
let isProcessing = false;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const uploadSection = document.getElementById('uploadSection');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const fileCount = document.getElementById('fileCount');
const addMoreButton = document.getElementById('addMoreButton');
const clearButton = document.getElementById('clearButton');
const mergeButton = document.getElementById('mergeButton');
const processingSection = document.getElementById('processingSection');
const enablePageSelection = document.getElementById('enablePageSelection');
const outputFilename = document.getElementById('outputFilename');
const accordionToggle = document.getElementById('accordionToggle');
const accordionContent = document.getElementById('accordionContent');

// ============================================
// INITIALIZATION
// ============================================

try {
    // Set default filename using shared utility
    outputFilename.value = getDefaultFilename('MergedPDF');
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

    uploadArea?.addEventListener('click', (e) => {
        try {
            if (e.target !== browseButton) {
                fileInput.click();
            }
        } catch (error) {
            console.error('Error in upload area click:', error);
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    addMoreButton?.addEventListener('click', () => {
        try {
            fileInput.click();
        } catch (error) {
            console.error('Error adding more files:', error);
            showErrorMessage('Unable to add more files. Please try again.');
        }
    });

    clearButton?.addEventListener('click', clearAllFiles);
    mergeButton?.addEventListener('click', mergePDFs);

    enablePageSelection?.addEventListener('change', (e) => {
        try {
            const pageInputs = document.querySelectorAll('.page-selection-wrapper');
            pageInputs.forEach(input => {
                if (e.target.checked) {
                    input.classList.add('active');
                } else {
                    input.classList.remove('active');
                }
            });
        } catch (error) {
            console.error('Error toggling page selection:', error);
        }
    });
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the application. Please refresh the page.');
}

// Setup drag and drop using shared utility
setupDragAndDrop(uploadArea, (files) => {
    handleFileSelect({ target: { files } });
}, { allowMultiple: true });

// ============================================
// FILE HANDLING
// ============================================

async function handleFileSelect(e) {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        if (!e || !e.target || !e.target.files) {
            console.error('Invalid event object in handleFileSelect');
            return;
        }

        const files = Array.from(e.target.files);
        if (files.length === 0) {
            return;
        }

        // Validate each file before adding
        const validFiles = [];
        const errors = [];

        for (const file of files) {
            try {
                // Check if it's a PDF using shared utility
                if (!isPDF(file)) {
                    errors.push(`"${file.name}" is not a PDF file`);
                    continue;
                }

                const validation = validateFileSize(file, true);
                if (!validation.valid) {
                    errors.push(validation.error);
                } else {
                    validFiles.push(file);
                    if (validation.warning) {
                        showWarningMessage(validation.warning);
                    }
                }
            } catch (error) {
                console.error('Error validating file:', file.name, error);
                errors.push(`Error validating "${file.name}"`);
            }
        }

        // Show errors if any
        if (errors.length > 0) {
            showErrorMessage(errors.join('\n'));
        }

        // Add valid files
        if (validFiles.length > 0) {
            await addFiles(validFiles);
        } else if (errors.length === 0) {
            showWarningMessage('No valid PDF files selected.');
        }

        fileInput.value = '';
    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        showErrorMessage('An error occurred while selecting files. Please try again.');
        fileInput.value = '';
    }
}

async function addFiles(files) {
    try {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        // Validate total size including existing files
        const potentialTotalFiles = [
            ...selectedFiles,
            ...files.map(f => ({ file: f, size: f.size, sizeBytes: f.size }))
        ];

        const totalValidation = validateTotalSize(potentialTotalFiles);
        if (!totalValidation.valid) {
            showErrorMessage(totalValidation.error);
            return;
        }

        // Check memory requirements
        const estimatedMemory = estimateMemoryUsage(totalValidation.totalSize);
        const memoryCheck = checkAvailableMemory(estimatedMemory);

        if (!memoryCheck.hasEnough) {
            showErrorMessage(memoryCheck.warning || 'Insufficient memory to process these files.');
            return;
        } else if (memoryCheck.warning) {
            showWarningMessage(memoryCheck.warning);
        }

        // Process each file using shared utility
        const failedFiles = [];

        for (const file of files) {
            try {
                const result = await loadPDFWithValidation(file);

                if (result.error) {
                    failedFiles.push({ name: file.name, error: result.error });
                    continue;
                }

                const fileData = {
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: formatFileSize(file.size),
                    sizeBytes: file.size,
                    pageCount: result.pageCount,
                    pageSelection: ''
                };

                selectedFiles.push(fileData);

                // Add UI warning if file is large
                const validation = validateFileSize(file, false);
                if (validation.warning) {
                    fileData.sizeWarning = validation.warning;
                }
            } catch (error) {
                console.error('Error loading PDF:', file.name, error);
                failedFiles.push({ name: file.name, error: 'Failed to load' });
            }
        }

        // Show errors for failed files
        if (failedFiles.length > 0) {
            const errorMessages = failedFiles.map(f => `"${f.name}": ${f.error}`).join('\n');
            showErrorMessage('Some files could not be loaded:\n' + errorMessages);
        }

        // Update UI if any files were added successfully
        if (selectedFiles.length > 0) {
            updateUI();
        }
    } catch (error) {
        console.error('Error in addFiles:', error);
        showErrorMessage('An error occurred while adding files. Please try again.');
    }
}

// ============================================
// UI FUNCTIONS
// ============================================

function updateUI() {
    try {
        if (selectedFiles.length > 0) {
            uploadSection.style.display = 'none';
            filesSection.style.display = 'block';
            renderFilesList();
            fileCount.textContent = selectedFiles.length;
            updateSizeDisplay();
        } else {
            uploadSection.style.display = 'block';
            filesSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating UI:', error);
        showErrorMessage('UI update failed. Please refresh the page.');
    }
}

function renderFilesList() {
    try {
        if (!filesList) {
            console.error('Files list element not found');
            return;
        }

        filesList.innerHTML = '';

        selectedFiles.forEach((fileData, index) => {
            try {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.draggable = true;
                fileItem.dataset.index = index;

                const pageInputHtml = `
                    <div class="page-selection-wrapper ${enablePageSelection?.checked ? 'active' : ''}">
                        <input type="text" 
                               class="page-selection-input" 
                               placeholder="e.g., 1,3,5-7" 
                               value="${fileData.pageSelection || ''}"
                               data-index="${index}">
                        <span class="page-hint">Leave empty for all pages</span>
                    </div>
                `;

                fileItem.innerHTML = `
                    <div class="drag-handle">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
                            <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                            <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                        </svg>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileData.name)}</div>
                        <div class="file-details">
                            ${fileData.size} • ${fileData.pageCount} page${fileData.pageCount !== 1 ? 's' : ''}
                        </div>
                        ${pageInputHtml}
                    </div>
                    <button class="remove-file" data-index="${index}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;

                // Drag events
                fileItem.addEventListener('dragstart', handleDragStart);
                fileItem.addEventListener('dragover', handleDragOver);
                fileItem.addEventListener('drop', handleDrop);
                fileItem.addEventListener('dragend', handleDragEnd);

                // Remove button
                const removeBtn = fileItem.querySelector('.remove-file');
                removeBtn.addEventListener('click', () => removeFile(index));

                // Page selection input
                const pageInput = fileItem.querySelector('.page-selection-input');
                pageInput?.addEventListener('input', (e) => {
                    selectedFiles[index].pageSelection = e.target.value;
                });

                filesList.appendChild(fileItem);
            } catch (error) {
                console.error('Error rendering file item:', fileData.name, error);
            }
        });
    } catch (error) {
        console.error('Error in renderFilesList:', error);
    }
}

function updateSizeDisplay() {
    try {
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
        const totalSizeElement = document.getElementById('totalSize');
        if (totalSizeElement) {
            totalSizeElement.textContent = formatFileSize(totalSize);
        }
    } catch (error) {
        console.error('Error updating size display:', error);
    }
}

function removeFile(index) {
    try {
        selectedFiles.splice(index, 1);
        updateUI();

        if (selectedFiles.length === 0) {
            if (enablePageSelection) {
                enablePageSelection.checked = false;
            }
        }
    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please try again.');
    }
}

function clearAllFiles() {
    try {
        selectedFiles = [];
        updateUI();

        if (enablePageSelection) {
            enablePageSelection.checked = false;
        }
    } catch (error) {
        console.error('Error clearing files:', error);
        showErrorMessage('Failed to clear files. Please try again.');
    }
}

// ============================================
// DRAG AND DROP FOR REORDERING
// ============================================

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    try {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedElement !== e.currentTarget) {
            const draggedIndex = parseInt(draggedElement.dataset.index);
            const targetIndex = parseInt(e.currentTarget.dataset.index);

            const draggedFile = selectedFiles[draggedIndex];
            selectedFiles.splice(draggedIndex, 1);
            selectedFiles.splice(targetIndex, 0, draggedFile);

            updateUI();
        }

        return false;
    } catch (error) {
        console.error('Error in handleDrop:', error);
    }
}

function handleDragEnd(e) {
    e.target.style.opacity = '1';

    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// ============================================
// MERGE PDF FUNCTION
// ============================================

async function mergePDFs() {
    if (isProcessing) {
        showWarningMessage('Merge operation already in progress. Please wait.');
        return;
    }

    try {
        if (selectedFiles.length === 0) {
            showErrorMessage('Please select at least one PDF file to merge.');
            return;
        }

        if (selectedFiles.length === 1) {
            showWarningMessage('Please add at least 2 PDF files to merge.');
            return;
        }

        isProcessing = true;
        setProcessingState(true, mergeButton, processingSection, 'Merge PDFs', 'Merging...');

        const mergedPdf = await PDFDocument.create();
        let successCount = 0;
        let failedFiles = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            try {
                const fileData = selectedFiles[i];
                const arrayBuffer = await fileData.file.arrayBuffer();

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    failedFiles.push({ name: fileData.name, error: 'Empty file' });
                    continue;
                }

                const pdf = await PDFDocument.load(arrayBuffer);
                const totalPages = pdf.getPageCount();

                let pagesToCopy = [];

                if (enablePageSelection?.checked && fileData.pageSelection.trim()) {
                    const result = parsePageSelection(fileData.pageSelection, totalPages);

                    if (result.error) {
                        failedFiles.push({ 
                            name: fileData.name, 
                            error: `Page selection error: ${result.error}` 
                        });
                        continue;
                    }

                    pagesToCopy = result.pages.map(p => p - 1);
                } else {
                    pagesToCopy = Array.from({ length: totalPages }, (_, i) => i);
                }

                if (pagesToCopy.length === 0) {
                    failedFiles.push({ name: fileData.name, error: 'No pages selected' });
                    continue;
                }

                const copiedPages = await mergedPdf.copyPages(pdf, pagesToCopy);
                copiedPages.forEach(page => mergedPdf.addPage(page));

                successCount++;
            } catch (error) {
                console.error('Error processing file:', selectedFiles[i].name, error);
                let errorMsg = 'Failed to process';

                if (error.message && error.message.includes('encrypted')) {
                    errorMsg = 'Password-protected';
                } else if (error.message && error.message.includes('Invalid')) {
                    errorMsg = 'Corrupted or invalid PDF';
                }

                failedFiles.push({ name: selectedFiles[i].name, error: errorMsg });
            }
        }

        if (successCount === 0) {
            throw new Error('No files could be merged. Please check the files and try again.');
        }

        const mergedPageCount = mergedPdf.getPageCount();
        if (mergedPageCount === 0) {
            throw new Error('The merged PDF has no pages. Please check your page selections.');
        }

        const pdfBytes = await mergedPdf.save();

        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error('Failed to generate merged PDF. Please try again.');
        }

        const filename = outputFilename.value.trim() || 'MergedPDF';
        await downloadPDF(pdfBytes, filename);

        let successMsg = `Successfully merged ${successCount} out of ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}.`;

        if (failedFiles.length > 0) {
            successMsg += '\n\nFailed files:\n' + failedFiles.map(f => `• ${f.name}: ${f.error}`).join('\n');
            showWarningMessage(successMsg);
        } else {
            showSuccessMessage(successMsg);
        }

        clearAllFiles();

    } catch (error) {
        console.error('Error merging PDFs:', error);
        showErrorMessage(error.message || 'An error occurred while merging PDFs. Please try again.');
    } finally {
        isProcessing = false;
        setProcessingState(false, mergeButton, processingSection, 'Merge PDFs', 'Merging...');
    }
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, mergeButton, processingSection, 'Merge PDFs', 'Merging...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, mergeButton, processingSection, 'Merge PDFs', 'Merging...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================

console.log('✅ Merge PDF Module Loaded (Deduplicated)');
console.log('   Using shared-utils.js for common functions');
