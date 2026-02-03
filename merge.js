// Merge PDF Functionality
const { PDFDocument } = PDFLib;

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

// Event Listeners
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
        addFiles(files);
    }
});

// Handle File Selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    fileInput.value = ''; // Reset input
}

// Add Files
function addFiles(files) {
    files.forEach(file => {
        selectedFiles.push({
            id: Date.now() + Math.random(),
            file: file,
            name: file.name,
            size: formatFileSize(file.size)
        });
    });

    updateUI();
}

// Update UI
function updateUI() {
    if (selectedFiles.length > 0) {
        uploadSection.style.display = 'none';
        filesSection.style.display = 'block';
        renderFilesList();
        fileCount.textContent = selectedFiles.length;
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
                <div class="file-name">${fileData.name}</div>
                <div class="file-size">${fileData.size}</div>
            </div>
            <div class="file-actions">
                <button class="icon-button delete" onclick="removeFile(${index})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;

        // Drag events for reordering
        fileItem.addEventListener('dragstart', handleDragStart);
        fileItem.addEventListener('dragover', handleDragOver);
        fileItem.addEventListener('drop', handleDrop);
        fileItem.addEventListener('dragend', handleDragEnd);

        filesList.appendChild(fileItem);
    });
}

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

// Drag and Drop for Reordering
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

// Merge PDFs
async function mergePDFs() {
    if (selectedFiles.length < 2) {
        alert('Please select at least 2 PDF files to merge');
        return;
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
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        }

        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();

        // Download the file
        downloadFile(mergedPdfBytes, 'merged-document.pdf');

        // Reset UI
        setTimeout(() => {
            processingSection.style.display = 'none';
            filesSection.style.display = 'block';

            // Show success message
            showSuccessMessage();
        }, 500);

    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('An error occurred while merging PDFs. Please try again.');
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';
    }
}

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
function showSuccessMessage() {
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
    `;
    message.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color: #2dff8f;">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>PDF merged successfully!</span>
        </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.style.transition = 'opacity 0.3s ease';
        message.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(message);
        }, 300);
    }, 2000);
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}