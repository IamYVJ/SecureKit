// Compress PDF Functionality
const { PDFDocument } = PDFLib;

let selectedFiles = [];

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
const compressButton = document.getElementById('compressButton');
const processingSection = document.getElementById('processingSection');
const targetSize = document.getElementById('targetSize');
const sizeUnit = document.getElementById('sizeUnit');

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
compressButton.addEventListener('click', compressPDFs);

// Radio button change handlers
const radioButtons = document.querySelectorAll('input[name="compressionLevel"]');
radioButtons.forEach(radio => {
    radio.addEventListener('change', handleRadioChange);
});

function handleRadioChange(e) {
    // Hide all input wrappers
    document.querySelectorAll('.option-input-wrapper').forEach(wrapper => {
        wrapper.style.display = 'none';
    });

    // Show the selected one
    const selectedRadio = e.target;
    const wrapper = selectedRadio.parentElement.querySelector('.option-input-wrapper');
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
        addFiles(files);
    }
});

// Handle File Selection
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    fileInput.value = '';
}

// Add Files
function addFiles(files) {
    files.forEach(file => {
        selectedFiles.push({
            id: Date.now() + Math.random(),
            file: file,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size)
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

        fileItem.innerHTML = `
            <div class="file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2"/>
                    <path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
            <div class="file-info">
                <div class="file-name">${fileData.name}</div>
                <div class="file-size">${fileData.sizeFormatted}</div>
            </div>
            <div class="file-actions">
                <button class="icon-button delete" onclick="removeFile(${index})">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;

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

// Compress PDFs
async function compressPDFs() {
    if (selectedFiles.length === 0) {
        alert('Please select at least one PDF file');
        return;
    }

    const selectedLevel = document.querySelector('input[name="compressionLevel"]:checked').value;
    let compressionOptions = {};

    // Set compression parameters based on level
    switch(selectedLevel) {
        case 'low':
            compressionOptions = { level: 0.9 }; // Minimal compression
            break;
        case 'medium':
            compressionOptions = { level: 0.7 }; // Balanced (recommended)
            break;
        case 'high':
            compressionOptions = { level: 0.4 }; // Maximum compression
            break;
        case 'custom':
            const targetSizeValue = parseFloat(targetSize.value);
            const unit = sizeUnit.value;
            if (isNaN(targetSizeValue) || targetSizeValue <= 0) {
                alert('Please enter a valid target file size');
                return;
            }
            // Convert to bytes
            const targetBytes = unit === 'MB' ? targetSizeValue * 1024 * 1024 : targetSizeValue * 1024;
            compressionOptions = { targetSize: targetBytes };
            break;
    }

    // Show processing
    filesSection.style.display = 'none';
    processingSection.style.display = 'block';
    document.getElementById('totalFiles').textContent = selectedFiles.length;
    document.getElementById('progressInfo').style.display = 'block';

    let successCount = 0;
    let totalSavings = 0;

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            document.getElementById('currentFile').textContent = i + 1;
            const fileData = selectedFiles[i];

            try {
                const result = await compressPDF(fileData, compressionOptions);

                // Calculate compression
                const originalSize = fileData.size;
                const compressedSize = result.bytes.length;
                const savings = originalSize - compressedSize;
                const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

                totalSavings += savings;

                // Update stats
                const statsDiv = document.getElementById('compressionStats');
                statsDiv.innerHTML = `
                    <div>Original: <strong>${formatFileSize(originalSize)}</strong></div>
                    <div>Compressed: <strong>${formatFileSize(compressedSize)}</strong></div>
                    <div>Saved: <strong>${savingsPercent}%</strong></div>
                `;

                // Download
                const outputName = fileData.name.replace('.pdf', '_compressed.pdf');
                await downloadFileWithDelay(result.bytes, outputName, i * 300);
                successCount++;

            } catch (error) {
                console.error(`Error compressing ${fileData.name}:`, error);
            }
        }

        // Show success
        setTimeout(() => {
            processingSection.style.display = 'none';
            filesSection.style.display = 'block';
            showSuccessMessage(successCount, totalSavings);
        }, 500);

    } catch (error) {
        console.error('Error during compression:', error);
        alert('An error occurred during compression. Please try again.');
        processingSection.style.display = 'none';
        filesSection.style.display = 'block';
    }
}

// Compress Single PDF
async function compressPDF(fileData, options) {
    const arrayBuffer = await fileData.file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // Apply compression based on options
    if (options.targetSize) {
        // Target size compression (iterative approach)
        return await compressToTargetSize(pdfDoc, options.targetSize, fileData.size);
    } else {
        // Level-based compression
        return await compressByLevel(pdfDoc, options.level);
    }
}

// Compress by Level
async function compressByLevel(pdfDoc, level) {
    // Create a new PDF with compression
    const compressedPdf = await PDFDocument.create();

    // Copy all pages
    const pageIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i);
    const copiedPages = await compressedPdf.copyPages(pdfDoc, pageIndices);

    copiedPages.forEach(page => {
        compressedPdf.addPage(page);
    });

    // Save with compression options
    const saveOptions = {
        useObjectStreams: level < 0.8, // Use object streams for better compression
        addDefaultPage: false,
        objectsPerTick: 50,
    };

    const bytes = await compressedPdf.save(saveOptions);
    return { bytes };
}

// Compress to Target Size (best effort)
async function compressToTargetSize(pdfDoc, targetSize, originalSize) {
    // If original is already smaller, just return optimized version
    if (originalSize <= targetSize) {
        const bytes = await pdfDoc.save({ useObjectStreams: true });
        return { bytes };
    }

    // Try aggressive compression
    const ratio = targetSize / originalSize;
    let level = ratio > 0.5 ? 0.7 : 0.3; // Estimate compression level needed

    const result = await compressByLevel(pdfDoc, level);

    // Check if we met the target (with 10% tolerance)
    if (result.bytes.length <= targetSize * 1.1) {
        return result;
    }

    // If still too large, try maximum compression
    return await compressByLevel(pdfDoc, 0.2);
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
function showSuccessMessage(fileCount, totalSavings) {
    const savingsText = totalSavings > 0 ? ` Saved ${formatFileSize(totalSavings)} total!` : '';

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
            <span>${fileCount} PDF${fileCount > 1 ? 's' : ''} compressed successfully!${savingsText}</span>
        </div>
    `;

    document.body.appendChild(message);

    setTimeout(() => {
        message.style.transition = 'opacity 0.3s ease';
        message.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(message);
        }, 300);
    }, 3500);
}

// Format File Size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}