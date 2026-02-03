// ============================================
// MERGE PDF - WITH FILE SIZE VALIDATION
// SecureKit - Client-Side PDF Processing
// ============================================

const { PDFDocument } = PDFLib;

// State
let selectedFiles = [];
let draggedElement = null;

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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `MergedPDF_${year}${month}${day}`;
}

outputFilename.value = getDefaultFilename();

// Accordion Toggle
accordionToggle.addEventListener('click', () => {
    accordionToggle.classList.toggle('active');
    accordionContent.classList.toggle('active');
});

// ============================================
// EVENT LISTENERS
// ============================================

browseButton.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('click', (e) => {
    if (e.target !== browseButton) {
        fileInput.click();
    }
});

fileInput.addEventListener('change', handleFileSelect);
addMoreButton.addEventListener('click', () => fileInput.click());
clearButton.addEventListener('click', clearAllFiles);
mergeButton.addEventListener('click', mergePDFs);

enablePageSelection.addEventListener('change', (e) => {
    const pageInputs = document.querySelectorAll('.page-selection-wrapper');
    pageInputs.forEach(input => {
        if (e.target.checked) {
            input.classList.add('active');
        } else {
            input.classList.remove('active');
        }
    });
});

// Drag and Drop for Upload Area
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
        handleFileSelect({ target: { files: files } });
    }
});

// ============================================
// FILE HANDLING WITH VALIDATION
// ============================================

// Handle File Selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);

    // Validate each file before adding
    const validFiles = [];
    const errors = [];

    for (const file of files) {
        const validation = validateFileSize(file, true);

        if (!validation.valid) {
            errors.push(validation.error);
        } else {
            validFiles.push(file);
            if (validation.warning) {
                showWarningMessage(validation.warning);
            }
        }
    }

    // Show errors if any
    if (errors.length > 0) {
        showErrorMessage(errors.join('\n'));
    }

    // Add valid files
    if (validFiles.length > 0) {
        addFiles(validFiles);
    }

    fileInput.value = ''; // Reset input
}

// Add Files with Size Validation
async function addFiles(files) {
    // First, validate total size including existing files
    const potentialTotalFiles = [...selectedFiles, ...files.map(f => ({ file: f, size: f.size, sizeBytes: f.size }))];
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
    for (const file of files) {
        try {
            // Load PDF to get page count
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const pageCount = pdf.getPageCount();

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
            console.error('Error loading PDF:', error);
            showErrorMessage(`Error loading ${file.name}. Please ensure it's a valid PDF.`);
        }
    }

    updateUI();
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

// Update UI
function updateUI() {
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
}

// Render Files List
function renderFilesList() {
    filesList.innerHTML = '';

    selectedFiles.forEach((fileData, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.draggable = true;
        fileItem.dataset.index = index;

        const pageInputHtml = `
            <div class="page-selection-wrapper ${enablePageSelection.checked ? 'active' : ''}">
                <input type="text" 
                       class="page-input" 
                       placeholder="e.g., 1-3,5,7 or leave empty for all pages" 
                       value="${fileData.pageSelection}"
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
        pageInput.addEventListener('input', (e) => {
            const fileIndex = parseInt(e.target.dataset.fileIndex);
            selectedFiles[fileIndex].pageSelection = e.target.value;
        });

        // Drag events for reordering
        fileItem.addEventListener('dragstart', handleDragStart);
        fileItem.addEventListener('dragover', handleDragOver);
        fileItem.addEventListener('drop', handleDrop);
        fileItem.addEventListener('dragend', handleDragEnd);

        filesList.appendChild(fileItem);
    });
}

// Update Size Display
function updateSizeDisplay() {
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
}

// ============================================
// DRAG AND DROP FOR REORDERING
// ============================================

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const afterElement = getDragAfterElement(filesList, e.clientY);
    const dragging = document.querySelector('.dragging');

    if (afterElement == null) {
        filesList.appendChild(dragging);
    } else {
        filesList.insertBefore(dragging, afterElement);
    }
}

function handleDrop(e) {
    e.preventDefault();
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');

    // Update the selectedFiles array based on new order
    const newOrder = [];
    const fileItems = filesList.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const index = parseInt(item.dataset.index);
        newOrder.push(selectedFiles[index]);
    });

    selectedFiles = newOrder;
    renderFilesList();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.file-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// ============================================
// PAGE SELECTION PARSING
// ============================================

function parsePageSelection(selection, totalPages) {
    if (!selection || !selection.trim()) {
        // Return all pages if no selection
        return Array.from({ length: totalPages }, (_, i) => i);
    }

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
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

// Clear All Files
function clearAllFiles() {
    selectedFiles = [];
    updateUI();
}

// ============================================
// MERGE PDFs WITH VALIDATION
// ============================================

async function mergePDFs() {
    if (selectedFiles.length < 1) {
        showErrorMessage('Please select at least 1 PDF file to merge');
        return;
    }

    // Final size validation before processing
    const totalValidation = validateTotalSize(selectedFiles);
    if (!totalValidation.valid) {
        showErrorMessage(totalValidation.error);
        return;
    }

    // Check storage quota for output
    const estimatedOutputSize = totalValidation.totalSize * 1.1; // Output is ~110% of input
    const storageCheck = await checkStorageQuota(estimatedOutputSize);
    if (!storageCheck.hasSpace) {
        showErrorMessage('Insufficient storage space for output file. Please free up some space.');
        return;
    }

    // Validate filename
    let filename = outputFilename.value.trim();
    if (!filename) {
        filename = getDefaultFilename();
    }

    // Sanitize filename to prevent injection
    filename = sanitizeFilename(filename);

    // Add .pdf extension if not present
    if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
    }

    // Show processing
    filesSection.style.display = 'none';
    processingSection.style.display = 'block';

    try {
        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        // Process each file
        for (const fileData of selectedFiles) {
            const arrayBuffer = await fileData.file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const totalPages = pdf.getPageCount();

            let pageIndices;

            try {
                // Parse page selection
                if (enablePageSelection.checked && fileData.pageSelection) {
                    pageIndices = parsePageSelection(fileData.pageSelection, totalPages);
                } else {
                    // Use all pages
                    pageIndices = Array.from({ length: totalPages }, (_, i) => i);
                }
            } catch (error) {
                showErrorMessage(`Error in page selection for ${fileData.name}: ${error.message}`);
                processingSection.style.display = 'none';
                filesSection.style.display = 'block';
                return;
            }

            // Copy selected pages
            const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();

        // Download the file
        downloadFile(mergedPdfBytes, filename);

        // Reset UI
        setTimeout(() => {
            processingSection.style.display = 'none';
            filesSection.style.display = 'block';

            // Show success message
            showSuccessMessage(filename);
        }, 500);

    } catch (error) {
        console.error('Error merging PDFs:', error);
        showErrorMessage('An error occurred while merging PDFs. Please try again.');
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';
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
function showSuccessMessage(filename) {
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
            <span>PDF merged successfully as ${escapeHtml(filename)}!</span>
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
    // Remove .pdf extension temporarily
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
