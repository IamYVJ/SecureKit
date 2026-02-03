// ============================================
// MERGE PDF - ENHANCED ERROR HANDLING
// SecureKit - Client-Side PDF Processing
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

// Set default filename
function getDefaultFilename() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `MergedPDF_${year}${month}${day}`;
    } catch (error) {
        console.error('Error generating default filename:', error);
        return 'MergedPDF';
    }
}

try {
    outputFilename.value = getDefaultFilename();
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

// Drag and Drop for Upload Area
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
                showWarningMessage('Please drop PDF files only.');
                return;
            }

            if (files.length > 0) {
                handleFileSelect({ target: { files: files } });
            }
        } catch (error) {
            console.error('Error handling file drop:', error);
            showErrorMessage('Failed to process dropped files. Please try using the file selector instead.');
        }
    });
} catch (error) {
    console.error('Error setting up drag and drop:', error);
}

// ============================================
// FILE HANDLING WITH ENHANCED ERROR HANDLING
// ============================================

// Handle File Selection
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
                // Check if it's a PDF
                if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
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

        fileInput.value = ''; // Reset input

    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        showErrorMessage('An error occurred while selecting files. Please try again.');
        fileInput.value = '';
    }
}

// Add Files with Size Validation and Error Handling
async function addFiles(files) {
    try {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        // First, validate total size including existing files
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

        // Process each file
        const failedFiles = [];

        for (const file of files) {
            try {
                // Load PDF to get page count
                const arrayBuffer = await file.arrayBuffer();

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    failedFiles.push({ name: file.name, error: 'File is empty or corrupted' });
                    continue;
                }

                const pdf = await PDFDocument.load(arrayBuffer);
                const pageCount = pdf.getPageCount();

                if (pageCount === 0) {
                    failedFiles.push({ name: file.name, error: 'PDF has no pages' });
                    continue;
                }

                const fileData = {
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: formatFileSize(file.size),
                    sizeBytes: file.size,
                    pageCount: pageCount,
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

                let errorMsg = 'Failed to load';
                if (error.message && error.message.includes('encrypted')) {
                    errorMsg = 'PDF is password-protected';
                } else if (error.message && error.message.includes('Invalid')) {
                    errorMsg = 'Invalid or corrupted PDF';
                }

                failedFiles.push({ name: file.name, error: errorMsg });
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
// UI UPDATE FUNCTIONS
// ============================================

// Update UI with error handling
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

// Render Files List with error handling
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
                    <div class="page-selection-wrapper ${enablePageSelection.checked ? 'active' : ''}">
                        <input type="text" 
                               class="page-input" 
                               placeholder="e.g., 1-3,5,7 or leave empty for all pages" 
                               value="${fileData.pageSelection || ''}"
                               data-file-index="${index}">
                        <div class="page-hint">Total pages: ${fileData.pageCount}</div>
                    </div>
                `;

                fileItem.innerHTML = `
                    <div class="drag-handle">
                        <div class="drag-line"></div>
                        <div class="drag-line"></div>
                        <div class="drag-line"></div>
                    </div>
                    <div class="file-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
                            <path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileData.name)}</div>
                        <div class="file-size">${fileData.size} • ${fileData.pageCount} pages</div>
                    </div>
                    <div class="file-actions">
                        <button class="icon-button delete" onclick="removeFile(${index})">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    ${pageInputHtml}
                `;

                // Add size warning if exists
                if (fileData.sizeWarning) {
                    const warningDiv = document.createElement('div');
                    warningDiv.className = 'file-size-warning';
                    warningDiv.style.cssText = `
                        width: 100%;
                        padding: 8px 12px;
                        background-color: rgba(255, 152, 0, 0.1);
                        border: 1px solid #ff9800;
                        border-radius: 8px;
                        color: #ff9800;
                        font-size: 12px;
                        margin-top: 8px;
                    `;
                    warningDiv.textContent = `⚠️ ${fileData.sizeWarning}`;
                    fileItem.appendChild(warningDiv);
                }

                // Add event listener for page input
                const pageInput = fileItem.querySelector('.page-input');
                if (pageInput) {
                    pageInput.addEventListener('input', (e) => {
                        try {
                            const fileIndex = parseInt(e.target.dataset.fileIndex);
                            if (!isNaN(fileIndex) && selectedFiles[fileIndex]) {
                                selectedFiles[fileIndex].pageSelection = e.target.value;
                            }
                        } catch (error) {
                            console.error('Error updating page selection:', error);
                        }
                    });
                }

                // Drag events for reordering
                fileItem.addEventListener('dragstart', handleDragStart);
                fileItem.addEventListener('dragover', handleDragOver);
                fileItem.addEventListener('drop', handleDrop);
                fileItem.addEventListener('dragend', handleDragEnd);

                filesList.appendChild(fileItem);

            } catch (error) {
                console.error('Error rendering file item:', fileData.name, error);
            }
        });

    } catch (error) {
        console.error('Error in renderFilesList:', error);
        showErrorMessage('Failed to display file list. Please refresh the page.');
    }
}

// Update Size Display with error handling
function updateSizeDisplay() {
    try {
        if (!fileCount || !fileCount.parentElement) {
            return;
        }

        const totalValidation = validateTotalSize(selectedFiles);
        const percentage = (totalValidation.totalSize / FILE_SIZE_CONFIG.MAX_TOTAL_MERGE * 100).toFixed(1);

        // Add or update size indicator
        let sizeIndicator = document.getElementById('totalSizeIndicator');
        if (!sizeIndicator) {
            sizeIndicator = document.createElement('div');
            sizeIndicator.id = 'totalSizeIndicator';
            sizeIndicator.style.cssText = `
                font-size: 13px;
                color: var(--text-secondary);
                margin-top: 4px;
            `;
            fileCount.parentElement.appendChild(sizeIndicator);
        }

        const sizeColor = percentage > 80 ? '#ff9800' : 'var(--text-secondary)';
        sizeIndicator.innerHTML = `
            <span style="color: ${sizeColor};">
                Total: ${formatFileSize(totalValidation.totalSize)} / ${formatFileSize(FILE_SIZE_CONFIG.MAX_TOTAL_MERGE)}
                (${percentage}%)
            </span>
        `;

    } catch (error) {
        console.error('Error updating size display:', error);
    }
}

// ============================================
// DRAG AND DROP FOR REORDERING
// ============================================

function handleDragStart(e) {
    try {
        draggedElement = e.target;
        e.target.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.innerHTML);
    } catch (error) {
        console.error('Error in handleDragStart:', error);
    }
}

function handleDragOver(e) {
    try {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    } catch (error) {
        console.error('Error in handleDragOver:', error);
        return false;
    }
}

function handleDrop(e) {
    try {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        e.preventDefault();

        if (!draggedElement || draggedElement === e.target) {
            return false;
        }

        const fromIndex = parseInt(draggedElement.dataset.index);
        const toIndex = parseInt(e.target.closest('.file-item')?.dataset.index);

        if (isNaN(fromIndex) || isNaN(toIndex) || fromIndex === toIndex) {
            return false;
        }

        // Reorder array
        const movedItem = selectedFiles.splice(fromIndex, 1)[0];
        selectedFiles.splice(toIndex, 0, movedItem);

        // Update UI
        renderFilesList();

        return false;
    } catch (error) {
        console.error('Error in handleDrop:', error);
        return false;
    }
}

function handleDragEnd(e) {
    try {
        e.target.style.opacity = '1';
        draggedElement = null;
    } catch (error) {
        console.error('Error in handleDragEnd:', error);
    }
}

// ============================================
// FILE OPERATIONS
// ============================================

// Remove Single File
function removeFile(index) {
    try {
        if (index < 0 || index >= selectedFiles.length) {
            console.error('Invalid file index:', index);
            return;
        }

        selectedFiles.splice(index, 1);
        updateUI();

        if (selectedFiles.length === 0) {
            clearAllMessages();
        }

    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please try again.');
    }
}

// Clear All Files
function clearAllFiles() {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        selectedFiles = [];
        updateUI();
        clearAllMessages();

    } catch (error) {
        console.error('Error clearing files:', error);
        showErrorMessage('Failed to clear files. Please refresh the page.');
    }
}

// ============================================
// PAGE SELECTION PARSING
// ============================================

function parsePageSelection(selection, totalPages) {
    try {
        if (!selection || selection.trim() === '') {
            // Return all pages
            return Array.from({ length: totalPages }, (_, i) => i);
        }

        const pages = new Set();
        const parts = selection.split(',').map(s => s.trim()).filter(s => s);

        for (const part of parts) {
            if (part.includes('-')) {
                // Range like "2-5"
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));

                if (isNaN(start) || isNaN(end)) {
                    throw new Error(`Invalid range format: "${part}". Use numbers only.`);
                }

                if (start < 1 || end > totalPages) {
                    throw new Error(`Range "${part}" is out of bounds. PDF has ${totalPages} pages.`);
                }

                if (start > end) {
                    throw new Error(`Invalid range "${part}". Start page must be less than or equal to end page.`);
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
                    throw new Error(`Page ${page} is out of bounds. PDF has ${totalPages} pages.`);
                }

                pages.add(page - 1); // Convert to 0-indexed
            }
        }

        if (pages.size === 0) {
            throw new Error('No valid pages selected.');
        }

        return Array.from(pages).sort((a, b) => a - b);

    } catch (error) {
        // Re-throw with better context
        throw new Error(`Page selection error: ${error.message}`);
    }
}

// ============================================
// MERGE PDF WITH COMPREHENSIVE ERROR HANDLING
// ============================================

async function mergePDFs() {
    // Prevent multiple simultaneous merges
    if (isProcessing) {
        showWarningMessage('A merge operation is already in progress. Please wait.');
        return;
    }

    try {
        // Validate we have files
        if (!selectedFiles || selectedFiles.length === 0) {
            showErrorMessage('Please add at least one PDF file to merge.');
            return;
        }

        if (selectedFiles.length === 1) {
            showWarningMessage('Please add at least 2 PDF files to merge.');
            return;
        }

        // Validate total size
        const totalValidation = validateTotalSize(selectedFiles);
        if (!totalValidation.valid) {
            showErrorMessage(totalValidation.error);
            return;
        }

        // Validate filename
        let filename = outputFilename.value.trim();
        if (!filename) {
            filename = getDefaultFilename();
        }

        // Sanitize filename
        filename = sanitizeFilename(filename);
        if (!filename) {
            showErrorMessage('Invalid filename. Using default name.');
            filename = getDefaultFilename();
        }

        // Check storage before starting
        const estimatedSize = totalValidation.totalSize * 0.8; // Rough estimate
        const storageCheck = await checkStorageQuota(estimatedSize);
        if (!storageCheck.hasSpace) {
            showErrorMessage(storageCheck.error || 'Insufficient storage space for the merged PDF.');
            return;
        }

        // Set processing flag and show processing UI
        isProcessing = true;
        filesSection.style.display = 'none';
        processingSection.style.display = 'block';

        // Create new PDF document
        const mergedPdf = await PDFDocument.create();
        const errors = [];
        let processedFiles = 0;
        let totalPagesAdded = 0;

        // Process each file
        for (let i = 0; i < selectedFiles.length; i++) {
            const fileData = selectedFiles[i];

            try {
                // Load the PDF
                const arrayBuffer = await fileData.file.arrayBuffer();

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    throw new Error('File is empty');
                }

                const pdf = await PDFDocument.load(arrayBuffer, {
                    ignoreEncryption: false
                });

                // Parse page selection if enabled
                let pageIndices;
                if (enablePageSelection.checked && fileData.pageSelection) {
                    try {
                        pageIndices = parsePageSelection(fileData.pageSelection, fileData.pageCount);
                    } catch (parseError) {
                        errors.push(`${fileData.name}: ${parseError.message}`);
                        continue; // Skip this file
                    }
                } else {
                    // All pages
                    pageIndices = Array.from({ length: fileData.pageCount }, (_, i) => i);
                }

                if (pageIndices.length === 0) {
                    errors.push(`${fileData.name}: No pages selected`);
                    continue;
                }

                // Copy pages
                const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
                copiedPages.forEach(page => mergedPdf.addPage(page));

                processedFiles++;
                totalPagesAdded += pageIndices.length;

            } catch (error) {
                console.error(`Error processing file ${fileData.name}:`, error);

                let errorMsg = 'Failed to process';
                if (error.message.includes('encrypted') || error.message.includes('password')) {
                    errorMsg = 'Password-protected (not supported)';
                } else if (error.message.includes('Invalid') || error.message.includes('parse')) {
                    errorMsg = 'Invalid or corrupted PDF';
                } else if (error.message.includes('Page selection')) {
                    errorMsg = error.message;
                } else {
                    errorMsg = `Processing error: ${error.message.substring(0, 50)}`;
                }

                errors.push(`${fileData.name}: ${errorMsg}`);
            }
        }

        // Check if any files were successfully processed
        if (processedFiles === 0) {
            throw new Error('No files could be processed successfully.\n\n' + errors.join('\n'));
        }

        // Show warnings for failed files
        if (errors.length > 0 && processedFiles > 0) {
            showWarningMessage(
                `Warning: ${errors.length} file(s) skipped:\n${errors.join('\n')}\n\nContinuing with ${processedFiles} file(s)...`,
                8000
            );
        }

        // Save the merged PDF
        const pdfBytes = await mergedPdf.save();

        if (!pdfBytes || pdfBytes.length === 0) {
            throw new Error('Failed to generate merged PDF. Output file is empty.');
        }

        // Download the file
        downloadFile(pdfBytes, filename + '.pdf');

        // Reset UI after a delay
        setTimeout(() => {
            try {
                processingSection.style.display = 'none';
                filesSection.style.display = 'block';
                isProcessing = false;

                // Show success message
                const successMsg = processedFiles === selectedFiles.length
                    ? `Successfully merged ${processedFiles} PDF files into one document with ${totalPagesAdded} total pages!`
                    : `Merged ${processedFiles} out of ${selectedFiles.length} files with ${totalPagesAdded} total pages.`;

                showSuccessMessage(successMsg);

            } catch (resetError) {
                console.error('Error resetting UI:', resetError);
                isProcessing = false;
            }
        }, 500);

    } catch (error) {
        console.error('Error merging PDFs:', error);

        // Reset processing flag
        isProcessing = false;

        // Reset UI
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';

        // Show error message
        const errorMessage = error.message || 'An unexpected error occurred while merging PDFs. Please try again.';
        showErrorMessage(errorMessage);
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

        // Append to body to ensure it works in all browsers
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        setTimeout(() => {
            try {
                URL.revokeObjectURL(url);
            } catch (revokeError) {
                console.warn('Failed to revoke object URL:', revokeError);
            }
        }, 100);

    } catch (error) {
        console.error('Error downloading file:', error);
        showErrorMessage('Failed to download the merged PDF. Please try again.');
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

        // If empty after sanitization, return empty
        // Caller should use default filename
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

            // Disable the interface
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

    // Don't show UI errors for script loading failures (already handled)
    if (event.message && event.message.includes('Script error')) {
        return;
    }

    // If processing, show error and reset
    if (isProcessing) {
        isProcessing = false;
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    if (isProcessing) {
        isProcessing = false;
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';
        showErrorMessage('An error occurred during processing. Please try again.');
    }
});

console.log('✅ Merge PDF module loaded successfully');
