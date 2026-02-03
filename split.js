// Split PDF Functionality
const { PDFDocument } = PDFLib;

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

// Event Listeners
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
        handleFile(files[0]);
    }
});

// Handle File Selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
    fileInput.value = '';
}

// Handle File
async function handleFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await PDFDocument.load(arrayBuffer);
        const pageCount = pdfDoc.getPageCount();

        selectedFile = {
            file: file,
            name: file.name,
            size: formatFileSize(file.size),
            pageCount: pageCount
        };

        updateUI();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF. Please ensure it\'s a valid PDF file.');
    }
}

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
        <div class="file-card">
            <div class="file-icon-large">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
                    <path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
            <div class="file-details">
                <div class="file-name-large">${selectedFile.name}</div>
                <div class="file-meta">
                    <div class="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>${selectedFile.pageCount} pages</span>
                    </div>
                    <div class="meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <span>${selectedFile.size}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Remove File
function removeFile() {
    selectedFile = null;
    pdfDoc = null;
    updateUI();
}

// Add Range Input
function addRangeInput() {
    const rangeItem = document.createElement('div');
    rangeItem.className = 'range-item';
    rangeItem.innerHTML = `
        <input type="text" class="page-input" placeholder="e.g., 1-5 or 2,4,6">
        <button class="remove-range-button" onclick="removeRange(this)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>
    `;
    rangesList.appendChild(rangeItem);
}

// Remove Range Input
function removeRange(button) {
    const rangeItem = button.parentElement;
    if (rangesList.children.length > 1) {
        rangeItem.remove();
    } else {
        alert('At least one range is required');
    }
}

// Parse Page Selection
function parsePageSelection(selection, totalPages) {
    if (!selection || selection.trim() === '') {
        return [];
    }

    const pages = new Set();
    const parts = selection.split(',').map(s => s.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                throw new Error(`Invalid range: ${part}`);
            }
            for (let i = start; i <= end; i++) {
                pages.add(i - 1);
            }
        } else {
            const page = parseInt(part);
            if (isNaN(page) || page < 1 || page > totalPages) {
                throw new Error(`Invalid page number: ${part}`);
            }
            pages.add(page - 1);
        }
    }

    return Array.from(pages).sort((a, b) => a - b);
}

// Split PDF
async function splitPDF() {
    if (!selectedFile || !pdfDoc) {
        alert('Please select a PDF file first');
        return;
    }

    const selectedMode = document.querySelector('input[name="splitMode"]:checked').value;
    const totalPages = selectedFile.pageCount;
    let splitTasks = [];

    try {
        if (selectedMode === 'all') {
            // Extract all pages separately
            for (let i = 0; i < totalPages; i++) {
                splitTasks.push([i]);
            }
        } else if (selectedMode === 'custom') {
            // Extract specific pages
            const pages = customPages.value;
            const pageIndices = parsePageSelection(pages, totalPages);
            if (pageIndices.length === 0) {
                alert('Please specify pages to extract');
                return;
            }
            // Each page becomes a separate PDF
            splitTasks = pageIndices.map(idx => [idx]);
        } else if (selectedMode === 'ranges') {
            // Extract custom ranges
            const rangeInputs = rangesList.querySelectorAll('input');
            for (const input of rangeInputs) {
                const pages = input.value.trim();
                if (pages) {
                    const pageIndices = parsePageSelection(pages, totalPages);
                    if (pageIndices.length > 0) {
                        splitTasks.push(pageIndices);
                    }
                }
            }
            if (splitTasks.length === 0) {
                alert('Please specify at least one range');
                return;
            }
        } else if (selectedMode === 'fixed') {
            // Split into fixed page chunks
            const pagesPerFile = parseInt(fixedPages.value);
            if (isNaN(pagesPerFile) || pagesPerFile < 1) {
                alert('Please enter a valid number of pages per file');
                return;
            }
            for (let i = 0; i < totalPages; i += pagesPerFile) {
                const chunk = [];
                for (let j = i; j < Math.min(i + pagesPerFile, totalPages); j++) {
                    chunk.push(j);
                }
                splitTasks.push(chunk);
            }
        }

        // Show processing
        fileSection.style.display = 'none';
        processingSection.style.display = 'block';
        document.getElementById('totalFiles').textContent = splitTasks.length;
        document.getElementById('progressInfo').style.display = 'block';

        // Get base filename
        let basename = baseFilename.value.trim();
        if (!basename) {
            basename = getDefaultFilename();
        }

        // Process each split task
        for (let i = 0; i < splitTasks.length; i++) {
            document.getElementById('currentFile').textContent = i + 1;

            const pageIndices = splitTasks[i];
            const newPdf = await PDFDocument.create();
            const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            const filename = `${basename}_${i + 1}.pdf`;

            // Download with small delay to avoid browser blocking
            await downloadFileWithDelay(pdfBytes, filename, i * 200);
        }

        // Show success
        setTimeout(() => {
            processingSection.style.display = 'none';
            fileSection.style.display = 'block';
            showSuccessMessage(splitTasks.length);
        }, 500);

    } catch (error) {
        console.error('Error splitting PDF:', error);
        alert(`Error: ${error.message}`);
        processingSection.style.display = 'none';
        fileSection.style.display = 'block';
    }
}

// Download File with Delay
function downloadFileWithDelay(data, filename, delay) {
    return new Promise(resolve => {
        setTimeout(() => {
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            resolve();
        }, delay);
    });
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
            <span>PDF split successfully! ${fileCount} file${fileCount > 1 ? 's' : ''} downloaded.</span>
        </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.style.transition = 'opacity 0.3s ease';
        message.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(message);
        }, 300);
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