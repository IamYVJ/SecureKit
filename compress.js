// ============================================
// COMPRESS PDF - ENHANCED & DEDUPLICATED
// SecureKit - Client-Side PDF Processing
// Uses shared-utils.js for common functions
// ============================================

const { PDFDocument } = PDFLib;

// State
let selectedFiles = [];
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
const compressButton = document.getElementById('compressButton');
const processingSection = document.getElementById('processingSection');
const targetSize = document.getElementById('targetSize');
const sizeUnit = document.getElementById('sizeUnit');

// ============================================
// EVENT LISTENERS
// ============================================

try {
    browseButton?.addEventListener('click', () => fileInput.click());

    uploadArea?.addEventListener('click', (e) => {
        if (e.target !== browseButton) {
            fileInput.click();
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    addMoreButton?.addEventListener('click', () => fileInput.click());
    clearButton?.addEventListener('click', clearAllFiles);
    compressButton?.addEventListener('click', compressPDFs);

    // Setup radio buttons using shared utility
    setupRadioButtons('compressionLevel', (e) => {
        handleRadioToggle(e, '.option-input-wrapper');
    });
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the application. Please refresh the page.');
}

// Setup drag and drop using shared utility
setupDragAndDrop(uploadArea, (files) => {
    addFiles(files);
}, { allowMultiple: true });

// ============================================
// FILE HANDLING
// ============================================

function handleFileSelect(e) {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        const files = Array.from(e.target.files);
        addFiles(files);
        fileInput.value = '';
    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        showErrorMessage('An error occurred while selecting files. Please try again.');
        fileInput.value = '';
    }
}

function addFiles(files) {
    try {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        const validFiles = [];
        const errors = [];

        files.forEach(file => {
            try {
                // Validate it's a PDF using shared utility
                if (!isPDF(file)) {
                    errors.push(`"${file.name}" is not a PDF file`);
                    return;
                }

                const validation = validateFileSize(file, true);

                if (!validation.valid) {
                    errors.push(validation.error);
                } else {
                    validFiles.push({
                        id: Date.now() + Math.random(),
                        file: file,
                        name: file.name,
                        size: file.size,
                        sizeFormatted: formatFileSize(file.size)
                    });

                    if (validation.warning) {
                        showWarningMessage(validation.warning);
                    }
                }
            } catch (error) {
                console.error('Error validating file:', file.name, error);
                errors.push(`Error validating "${file.name}"`);
            }
        });

        if (errors.length > 0) {
            showErrorMessage(errors.join('\n'));
        }

        if (validFiles.length > 0) {
            selectedFiles.push(...validFiles);
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

                fileItem.innerHTML = `
                    <div class="file-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileData.name)}</div>
                        <div class="file-size">${fileData.sizeFormatted}</div>
                    </div>
                    <button class="remove-file" data-index="${index}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;

                const removeBtn = fileItem.querySelector('.remove-file');
                removeBtn?.addEventListener('click', () => removeFile(index));

                filesList.appendChild(fileItem);
            } catch (error) {
                console.error('Error rendering file item:', fileData.name, error);
            }
        });
    } catch (error) {
        console.error('Error in renderFilesList:', error);
    }
}

function removeFile(index) {
    try {
        selectedFiles.splice(index, 1);
        updateUI();
    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please try again.');
    }
}

function clearAllFiles() {
    try {
        selectedFiles = [];
        updateUI();
    } catch (error) {
        console.error('Error clearing files:', error);
        showErrorMessage('Failed to clear files. Please try again.');
    }
}

// ============================================
// COMPRESS PDF FUNCTION
// ============================================

async function compressPDFs() {
    if (isProcessing) {
        showWarningMessage('Compression operation already in progress. Please wait.');
        return;
    }

    try {
        if (selectedFiles.length === 0) {
            showErrorMessage('Please select at least one PDF file to compress.');
            return;
        }

        const compressionLevel = document.querySelector('input[name="compressionLevel"]:checked')?.value;

        if (!compressionLevel) {
            showErrorMessage('Please select a compression level.');
            return;
        }

        isProcessing = true;
        setProcessingState(true, compressButton, processingSection, 'Compress PDFs', 'Compressing...');

        let compressionOptions = {};

        // Determine compression settings
        if (compressionLevel === 'low') {
            compressionOptions = {
                objectsPerTick: 50,
                useObjectStreams: true
            };
        } else if (compressionLevel === 'medium') {
            compressionOptions = {
                objectsPerTick: 25,
                useObjectStreams: true
            };
        } else if (compressionLevel === 'high') {
            compressionOptions = {
                objectsPerTick: 10,
                useObjectStreams: true
            };
        } else if (compressionLevel === 'custom') {
            const targetSizeValue = parseInt(targetSize?.value);
            const unit = sizeUnit?.value || 'MB';

            if (isNaN(targetSizeValue) || targetSizeValue < 1) {
                throw new Error('Please enter a valid target size (minimum 1).');
            }

            // Convert to bytes
            const targetSizeBytes = unit === 'MB' 
                ? targetSizeValue * 1024 * 1024 
                : targetSizeValue * 1024;

            compressionOptions = {
                targetSize: targetSizeBytes,
                objectsPerTick: 10,
                useObjectStreams: true
            };
        }

        const successfulCompressions = [];
        const failedCompressions = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            try {
                const fileData = selectedFiles[i];
                const arrayBuffer = await fileData.file.arrayBuffer();

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    failedCompressions.push({ 
                        name: fileData.name, 
                        error: 'Empty file' 
                    });
                    continue;
                }

                // Load PDF
                let pdfDoc;
                try {
                    pdfDoc = await PDFDocument.load(arrayBuffer);
                } catch (loadError) {
                    let errorMsg = 'Failed to load';

                    if (loadError.message?.includes('encrypted') || loadError.message?.includes('password')) {
                        errorMsg = 'Password-protected';
                    } else if (loadError.message?.includes('Invalid')) {
                        errorMsg = 'Corrupted or invalid PDF';
                    }

                    failedCompressions.push({ name: fileData.name, error: errorMsg });
                    continue;
                }

                // Save with compression
                const compressedBytes = await pdfDoc.save(compressionOptions);

                if (!compressedBytes || compressedBytes.length === 0) {
                    failedCompressions.push({ 
                        name: fileData.name, 
                        error: 'Compression produced empty file' 
                    });
                    continue;
                }

                const originalSize = fileData.size;
                const compressedSize = compressedBytes.length;
                const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

                // Generate filename
                const baseName = fileData.name.replace(/\.pdf$/i, '');
                const compressedFileName = `${baseName}_compressed`;

                successfulCompressions.push({
                    bytes: compressedBytes,
                    filename: compressedFileName,
                    originalSize: originalSize,
                    compressedSize: compressedSize,
                    reduction: reduction
                });
            } catch (error) {
                console.error('Error compressing file:', selectedFiles[i].name, error);
                failedCompressions.push({ 
                    name: selectedFiles[i].name, 
                    error: 'Compression failed' 
                });
            }
        }

        if (successfulCompressions.length === 0) {
            throw new Error('No files could be compressed. Please check the files and try again.');
        }

        // Download compressed PDFs using shared utility
        const results = await downloadMultiplePDFs(
            successfulCompressions.map(c => ({ 
                bytes: c.bytes, 
                filename: c.filename 
            })), 
            100
        );

        // Calculate average compression
        const avgReduction = (
            successfulCompressions.reduce((sum, c) => sum + parseFloat(c.reduction), 0) / 
            successfulCompressions.length
        ).toFixed(1);

        let successMsg = `Successfully compressed ${successfulCompressions.length} out of ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}.`;
        successMsg += `\nAverage size reduction: ${avgReduction}%`;

        if (failedCompressions.length > 0 || results.failed > 0) {
            const allFailures = [
                ...failedCompressions.map(f => `• ${f.name}: ${f.error}`),
                ...results.errors.map(e => `• ${e.filename}: ${e.error}`)
            ];

            if (allFailures.length > 0) {
                successMsg += '\n\nFailed compressions:\n' + allFailures.join('\n');
            }

            showWarningMessage(successMsg);
        } else {
            showSuccessMessage(successMsg);
        }

        clearAllFiles();

    } catch (error) {
        console.error('Error compressing PDFs:', error);
        showErrorMessage(error.message || 'An error occurred while compressing PDFs. Please try again.');
    } finally {
        isProcessing = false;
        setProcessingState(false, compressButton, processingSection, 'Compress PDFs', 'Compressing...');
    }
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, compressButton, processingSection, 'Compress PDFs', 'Compressing...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (isProcessing) {
        isProcessing = false;
        setProcessingState(false, compressButton, processingSection, 'Compress PDFs', 'Compressing...');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

// ============================================
// INITIALIZATION COMPLETE
// ============================================

console.log('✅ Compress PDF Module Loaded (Deduplicated)');
console.log('   Using shared-utils.js for common functions');
