// ============================================
// IMAGE TO PDF - SecureKit
// Client-side image to PDF conversion using PDF-lib
// ============================================

const { PDFDocument } = PDFLib;

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

// Page sizes in PDF points (1 inch = 72 pt)
const PAGE_SIZES = {
    a4:     [595.28, 841.89],
    letter: [612, 792],
    legal:  [612, 1008],
    a3:     [841.89, 1190.55],
    a5:     [419.53, 595.28]
};

let selectedImages = [];
let isProcessing = false;
let workflowStage = 'setup';
let lastConversionResult = null;
let draggedIndex = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const uploadSection = document.getElementById('uploadSection');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const fileCount = document.getElementById('fileCount');
const addMoreButton = document.getElementById('addMoreButton');
const clearButton = document.getElementById('clearButton');
const convertButton = document.getElementById('convertButton');
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

const accordionToggle = document.getElementById('accordionToggle');
const accordionContent = document.getElementById('accordionContent');
const pageSizeSelect = document.getElementById('pageSize');
const orientationSelect = document.getElementById('orientation');
const marginSelect = document.getElementById('margin');
const fitModeSelect = document.getElementById('fitMode');
const outputFilename = document.getElementById('outputFilename');

function isImageFile(file) {
    if (!file) return false;
    if (ALLOWED_IMAGE_MIMES.includes(file.type)) return true;
    const lower = file.name.toLowerCase();
    return ALLOWED_IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

function validateImage(file) {
    if (!isImageFile(file)) {
        return { valid: false, error: `"${file.name}" is not a JPG or PNG image` };
    }
    if (file.size === 0) {
        return { valid: false, error: `"${file.name}" is empty` };
    }
    if (file.size > MAX_IMAGE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (MAX_IMAGE_SIZE / (1024 * 1024)).toFixed(0);
        return { valid: false, error: `"${file.name}" is too large (${sizeMB} MB). Maximum: ${maxMB} MB.` };
    }
    return { valid: true };
}

try {
    if (typeof PDFLib === 'undefined') {
        throw new Error('PDF-lib failed to load');
    }

    browseButton?.addEventListener('click', () => fileInput.click());

    uploadArea?.addEventListener('click', (e) => {
        if (!browseButton?.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    addMoreButton?.addEventListener('click', () => fileInput.click());
    clearButton?.addEventListener('click', clearAllImages);
    convertButton?.addEventListener('click', convertToPDF);
    saveButton?.addEventListener('click', saveResult);
    anotherButton?.addEventListener('click', startAnother);

    setupAccordion(accordionToggle, accordionContent);

    if (outputFilename) {
        outputFilename.value = getDefaultFilename('ImagesToPDF');
    }
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the converter. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => addImages(files), {
    allowMultiple: true,
    fileType: ALLOWED_IMAGE_MIMES,
    rejectMessage: 'Please drop JPG or PNG images only.'
});

function handleFileSelect(e) {
    if (isProcessing) {
        showWarningMessage('Please wait for the current operation to complete.');
        return;
    }
    const files = Array.from(e.target.files);
    addImages(files);
    fileInput.value = '';
}

function addImages(files) {
    if (!Array.isArray(files) || files.length === 0) return;

    const valid = [];
    const errors = [];

    files.forEach((file) => {
        const result = validateImage(file);
        if (!result.valid) {
            errors.push(result.error);
            return;
        }
        valid.push({
            id: Date.now() + Math.random(),
            file,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.type || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
        });
    });

    if (errors.length > 0) {
        showErrorMessage(errors.join('\n'));
    }

    if (valid.length > 0) {
        selectedImages.push(...valid);
        updateUI();
    }
}

function removeImage(index) {
    selectedImages.splice(index, 1);
    updateUI();
}

function clearAllImages() {
    selectedImages = [];
    lastConversionResult = null;
    updateUI();
}

const sections = {
    upload: uploadSection,
    files: filesSection,
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
    if (selectedImages.length > 0) {
        uploadSection.style.display = 'none';
        filesSection.style.display = 'block';
        renderImagesList();
        fileCount.textContent = selectedImages.length;
    } else {
        uploadSection.style.display = 'block';
        filesSection.style.display = 'none';
    }
}

function updateUI() {
    applyWorkflowStage(workflowStage, sections, { setupHandler });
}

function setWorkflowStage(stage) {
    workflowStage = stage;
    applyWorkflowStage(stage, sections, { setupHandler, scrollOnTransition: true });
}

function renderImagesList() {
    if (!filesList) return;
    filesList.innerHTML = '';

    selectedImages.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.draggable = true;
        item.dataset.index = index;

        item.innerHTML = `
            <div class="drag-handle" aria-label="Drag to reorder">
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
                <div class="file-header-row">
                    <div class="file-meta">
                        <div class="file-name">Page ${index + 1} - ${escapeHtml(img.name)}</div>
                        <div class="file-details">${img.sizeFormatted} - ${img.type === 'image/png' ? 'PNG' : 'JPG'}</div>
                    </div>
                    <button class="remove-file" data-index="${index}" aria-label="Remove ${escapeHtml(img.name)}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        item.querySelector('.remove-file')?.addEventListener('click', () => removeImage(index));

        filesList.appendChild(item);
    });
}

function handleDragStart(e) {
    draggedIndex = parseInt(e.currentTarget.dataset.index, 10);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.currentTarget.dataset.index, 10);
    if (draggedIndex === null || isNaN(targetIndex) || draggedIndex === targetIndex) return;
    const [moved] = selectedImages.splice(draggedIndex, 1);
    selectedImages.splice(targetIndex, 0, moved);
    renderImagesList();
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedIndex = null;
}

function getPageDimensions(image, pageSizeKey, orientationKey) {
    if (pageSizeKey === 'auto') {
        // Use image's pixel dimensions as PDF points (rough but workable for "auto")
        let w = image.width;
        let h = image.height;
        if (orientationKey === 'landscape' && w < h) [w, h] = [h, w];
        if (orientationKey === 'portrait' && w > h) [w, h] = [h, w];
        return [w, h];
    }

    const base = PAGE_SIZES[pageSizeKey] || PAGE_SIZES.a4;
    let [w, h] = base;

    if (orientationKey === 'landscape') {
        if (w < h) [w, h] = [h, w];
    } else if (orientationKey === 'portrait') {
        if (w > h) [w, h] = [h, w];
    } else {
        // auto: match image aspect
        if (image.width > image.height && w < h) [w, h] = [h, w];
        if (image.width < image.height && w > h) [w, h] = [h, w];
    }

    return [w, h];
}

function computeDrawRect(imageW, imageH, pageW, pageH, margin, fitMode) {
    const availW = Math.max(1, pageW - margin * 2);
    const availH = Math.max(1, pageH - margin * 2);

    if (fitMode === 'stretch') {
        return { x: margin, y: margin, width: availW, height: availH };
    }

    const imageAspect = imageW / imageH;
    const availAspect = availW / availH;

    if (fitMode === 'cover') {
        let drawW, drawH;
        if (imageAspect > availAspect) {
            drawH = availH;
            drawW = drawH * imageAspect;
        } else {
            drawW = availW;
            drawH = drawW / imageAspect;
        }
        return {
            x: margin + (availW - drawW) / 2,
            y: margin + (availH - drawH) / 2,
            width: drawW,
            height: drawH
        };
    }

    // contain (default)
    let drawW, drawH;
    if (imageAspect > availAspect) {
        drawW = availW;
        drawH = drawW / imageAspect;
    } else {
        drawH = availH;
        drawW = drawH * imageAspect;
    }
    return {
        x: margin + (availW - drawW) / 2,
        y: margin + (availH - drawH) / 2,
        width: drawW,
        height: drawH
    };
}

async function convertToPDF() {
    if (isProcessing) {
        showWarningMessage('Conversion already in progress.');
        return;
    }

    if (selectedImages.length === 0) {
        showErrorMessage('Please select at least one image.');
        return;
    }

    const pageSizeKey = pageSizeSelect?.value || 'auto';
    const orientationKey = orientationSelect?.value || 'auto';
    const margin = parseFloat(marginSelect?.value || '0') || 0;
    const fitMode = fitModeSelect?.value || 'contain';

    isProcessing = true;
    setProcessingState(true, convertButton, null, 'Convert to PDF', 'Converting...');
    setWorkflowStage('processing');

    try {
        const pdfDoc = await PDFDocument.create();
        const failures = [];
        let pagesAdded = 0;

        for (let i = 0; i < selectedImages.length; i++) {
            const imgData = selectedImages[i];
            updateProgress(i + 1, selectedImages.length, `Embedding "${imgData.name}"`, `${imgData.sizeFormatted}`);

            try {
                const bytes = new Uint8Array(await imgData.file.arrayBuffer());
                let embedded;
                if (imgData.type === 'image/png') {
                    embedded = await pdfDoc.embedPng(bytes);
                } else {
                    embedded = await pdfDoc.embedJpg(bytes);
                }

                const [pageW, pageH] = getPageDimensions(embedded, pageSizeKey, orientationKey);
                const page = pdfDoc.addPage([pageW, pageH]);
                const rect = computeDrawRect(embedded.width, embedded.height, pageW, pageH, margin, fitMode);

                page.drawImage(embedded, {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                });
                pagesAdded++;
            } catch (error) {
                console.error('Error embedding image:', imgData.name, error);
                failures.push({ name: imgData.name, error: error.message || 'Could not embed image' });
            }

            // Yield to UI
            await new Promise((r) => setTimeout(r, 0));
        }

        if (pagesAdded === 0) {
            throw new Error('No images could be added to the PDF.');
        }

        updateProgress(selectedImages.length, selectedImages.length, 'Writing PDF...', '');
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });

        const baseFilename = sanitizeFilename(outputFilename?.value?.trim() || getDefaultFilename('ImagesToPDF'));
        const filename = baseFilename || getDefaultFilename('ImagesToPDF');

        showCompletion({
            bytes: pdfBytes,
            filename,
            pagesAdded,
            totalImages: selectedImages.length,
            failures
        });
    } catch (error) {
        console.error('Error converting to PDF:', error);
        showErrorMessage(error.message || 'Failed to convert images to PDF.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, convertButton, null, 'Convert to PDF', 'Converting...');
    }
}

function updateProgress(fileIndex, totalCount, message, stats) {
    updateProgressUI(progressElements, fileIndex, totalCount, message, stats);
}

function resetProgress() {
    resetProgressUI(progressElements, {
        title: 'Converting images to PDF...',
        message: 'Please wait while we build your document'
    });
}

function showCompletion(result) {
    lastConversionResult = result;

    if (completionTitle) completionTitle.textContent = 'PDF Ready';

    if (completionSummary) {
        completionSummary.textContent = `Created a ${result.pagesAdded}-page PDF from ${result.totalImages} image${result.totalImages !== 1 ? 's' : ''}.`;
    }

    if (completionStats) {
        completionStats.innerHTML = [
            { label: 'Pages', value: String(result.pagesAdded) },
            { label: 'Output Size', value: formatFileSize(result.bytes.length) },
            { label: 'Filename', value: `${result.filename}.pdf` }
        ].map((item) => `
            <div class="completion-stat">
                <span class="completion-stat-label">${escapeHtml(item.label)}</span>
                <span class="completion-stat-value">${escapeHtml(item.value)}</span>
            </div>
        `).join('');
    }

    if (completionDetails) {
        const notes = ['<div class="completion-note"><strong>Done:</strong> Your PDF is ready to save.</div>'];
        if (result.failures.length > 0) {
            notes.push(`<div class="completion-note"><strong>Skipped:</strong> ${result.failures.length} image${result.failures.length !== 1 ? 's were' : ' was'} not added.</div>`);
            const list = result.failures.map((f) => `
                <div class="completion-list-item">
                    <strong>${escapeHtml(f.name)}</strong>
                    <span>${escapeHtml(f.error)}</span>
                </div>
            `).join('');
            notes.push(`<div class="completion-list">${list}</div>`);
        }
        completionDetails.innerHTML = notes.join('');
    }

    setWorkflowStage('completed');
}

async function saveResult() {
    if (!lastConversionResult) {
        showWarningMessage('No PDF is ready to save.');
        return;
    }
    try {
        await downloadPDF(lastConversionResult.bytes, lastConversionResult.filename);
    } catch (error) {
        console.error('Error saving PDF:', error);
        showErrorMessage(error.message || 'Failed to save the PDF.');
    }
}

function startAnother() {
    lastConversionResult = null;
    clearAllImages();
    if (outputFilename) outputFilename.value = getDefaultFilename('ImagesToPDF');
    setWorkflowStage('setup');
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, convertButton, null, 'Convert to PDF', 'Converting...');
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

console.log('Image to PDF module loaded.');
