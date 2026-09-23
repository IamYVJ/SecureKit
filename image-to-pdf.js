// ============================================
// IMAGE TO PDF - SecureKit
// Client-side image to PDF conversion using PDF-lib
// ============================================

const { PDFDocument } = PDFLib;

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

/*
 * Memory cost is driven by format, not by file size.
 *
 * pdf-lib embeds a JPEG's compressed stream verbatim, so a 5.5 MB / 9 megapixel
 * JPEG costs almost nothing beyond its own bytes. A PNG is fully decoded to RGBA
 * first, so cost scales with pixels and is unrelated to how well the file
 * compressed: a 0.17 MB 3000x3000 PNG measured ~103 MB of heap, roughly 600x its
 * file size. Estimating from file size alone would miss that by two orders of
 * magnitude.
 *
 * Measured heap was 2.0-3.2x the raw RGBA buffer across sizes; 3 is the
 * conservative end of that range.
 */
const PNG_DECODE_FACTOR = 3;
const JPEG_EMBED_FACTOR = 2;

// Used when a header will not parse. Such a file will almost certainly fail to
// embed anyway, so this only needs to be non-trivial, not accurate.
const UNKNOWN_DIMENSION_FACTOR = 12;

// The ceiling itself lives in shared-utils.js, so every tool enforces the
// same one. Without it a single absurd image (20000x20000 PNG, ~4.8 GB) would
// sail through on any browser that does not expose performance.memory.

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
let cancellation = null;
let resetStopButton = () => {};
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
const stopButton = document.getElementById('stopButton');
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

/**
 * Read an image's pixel dimensions from its header, without decoding it.
 *
 * Decoding is the thing being guarded against, so the guard cannot afford to
 * decode in order to measure. Both formats state their size in the first few
 * bytes.
 *
 * @param {File} file - Image to inspect
 * @returns {Promise<Object|null>} - { width, height }, or null if unreadable
 */
async function readImageDimensions(file) {
    try {
        // A baseline JPEG puts its frame header near the start, but a
        // progressive one can carry a lot of metadata first. 256 KB is
        // comfortably past any realistic EXIF/ICC payload.
        const header = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);

        // PNG: 8-byte signature, then IHDR carries width and height.
        if (header.length >= 24
            && header[0] === 0x89 && header[1] === 0x50
            && header[2] === 0x4e && header[3] === 0x47) {
            return { width: view.getUint32(16), height: view.getUint32(20) };
        }

        // JPEG: walk the segment chain looking for a Start Of Frame.
        if (header.length >= 4 && header[0] === 0xff && header[1] === 0xd8) {
            let i = 2;

            while (i + 9 < header.length) {
                if (header[i] !== 0xff) {
                    i++;            // fill byte or padding; resync
                    continue;
                }

                const marker = header[i + 1];

                // SOF0-SOF15 describe the frame. C4 (Huffman tables), C8
                // (reserved) and CC (arithmetic coding conditioning) sit in the
                // same numeric range but are not frame headers.
                if (marker >= 0xc0 && marker <= 0xcf
                    && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                    return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
                }

                // Standalone markers carry no length field.
                if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                    i += 2;
                    continue;
                }

                const length = view.getUint16(i + 2);
                if (length < 2) {
                    break;          // malformed; stop rather than loop forever
                }
                i += 2 + length;
            }
        }
    } catch (error) {
        console.warn('Could not read image dimensions:', file.name, error);
    }

    return null;
}

/**
 * Estimate peak memory for embedding one image.
 *
 * @param {Object} image - { type, size, width, height }
 * @returns {number} - Estimated bytes
 */
function estimateImageMemory(image) {
    if (image.type === 'image/png') {
        if (image.width && image.height) {
            return image.width * image.height * 4 * PNG_DECODE_FACTOR;
        }
        return image.size * UNKNOWN_DIMENSION_FACTOR;
    }

    return image.size * JPEG_EMBED_FACTOR;
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
    resetStopButton = setupStopButton(stopButton, () => cancellation?.cancel());
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

async function addImages(files) {
    try {
        if (!Array.isArray(files) || files.length === 0) return;

        const valid = [];
        const errors = [];

        for (const file of files) {
            const result = validateImage(file);
            if (!result.valid) {
                errors.push(result.error);
                continue;
            }

            const type = file.type
                || (file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
            const dimensions = await readImageDimensions(file);

            valid.push({
                id: Date.now() + Math.random(),
                file,
                name: file.name,
                size: file.size,
                sizeFormatted: formatFileSize(file.size),
                type,
                width: dimensions?.width || null,
                height: dimensions?.height || null
            });
        }

        if (errors.length > 0) {
            showErrorMessage(errors.join('\n'));
        }

        if (valid.length === 0) {
            return;
        }

        // Guard against the whole batch, not just the new files: every image stays
        // in the document until save, so cost accumulates across additions.
        const combined = [...selectedImages, ...valid];

        const totalValidation = validateTotalSize(combined);
        if (!totalValidation.valid) {
            showErrorMessage(totalValidation.error);
            return;
        }

        const estimatedMemory = combined.reduce(
            (sum, image) => sum + estimateImageMemory(image), 0);

        const budget = checkMemoryBudget(
            estimatedMemory,
            'Convert them in smaller batches, or save large PNGs as JPG first - '
            + 'JPGs are embedded without being decoded.');

        if (!budget.ok) {
            showErrorMessage(budget.error);
            return;
        }

        if (budget.warning) {
            showWarningMessage(budget.warning);
        }

        selectedImages.push(...valid);
        updateUI();
    } catch (error) {
        console.error('Error in addImages:', error);
        showErrorMessage('An error occurred while adding images. Please try again.');
    }
}

function removeImage(index) {
    const [removed] = selectedImages.splice(index, 1);
    updateUI();

    announce(`${removed.name} removed. ${selectedImages.length} image${selectedImages.length === 1 ? '' : 's'} selected.`);
    focusAfterRemoval(filesList, index, '.remove-file', addMoreButton);
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
        item.setAttribute('role', 'listitem');

        item.innerHTML = `
            <div class="drag-handle" aria-hidden="true">
                <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
                    <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
                    <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
                    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                </svg>
            </div>
            <div class="reorder-controls">
                <button type="button" class="reorder-button" data-dir="up" data-index="${index}"
                        aria-label="Move ${escapeHtml(img.name)} up"
                        ${index === 0 ? 'disabled' : ''}>
                    <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button type="button" class="reorder-button" data-dir="down" data-index="${index}"
                        aria-label="Move ${escapeHtml(img.name)} down"
                        ${index === selectedImages.length - 1 ? 'disabled' : ''}>
                    <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="file-info">
                <div class="file-header-row">
                    <div class="file-meta">
                        <div class="file-name">Page ${index + 1} - ${escapeHtml(img.name)}</div>
                        <div class="file-details">${img.sizeFormatted} - ${img.type === 'image/png' ? 'PNG' : 'JPG'}</div>
                    </div>
                    <button type="button" class="remove-file" data-index="${index}" aria-label="Remove ${escapeHtml(img.name)}">
                        <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

        item.querySelectorAll('.reorder-button').forEach(button => {
            button.addEventListener('click', () => {
                moveImage(index, button.dataset.dir === 'up' ? -1 : 1);
            });
        });

        filesList.appendChild(item);
    });
}

/**
 * Keyboard-accessible reordering, since dragging needs a pointer.
 * Page order is the output order, so this has to be reachable without a mouse.
 *
 * @param {number} index - Current position of the image
 * @param {number} offset - -1 to move up, 1 to move down
 */
function moveImage(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= selectedImages.length) {
        return;
    }

    const [moved] = selectedImages.splice(index, 1);
    selectedImages.splice(target, 0, moved);
    renderImagesList();

    announce(`${moved.name} moved to page ${target + 1} of ${selectedImages.length}`);

    // The list was rebuilt; put focus back on the row that moved. The button
    // is disabled at either end, so fall back to the other direction.
    const row = filesList?.children[target];
    const direction = offset < 0 ? 'up' : 'down';
    const preferred = row?.querySelector(`.reorder-button[data-dir="${direction}"]`);
    const fallback = row?.querySelector('.reorder-button:not([disabled])');
    (preferred && !preferred.disabled ? preferred : fallback)?.focus();
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
    cancellation = createCancellation();
    setProcessingState(true, convertButton, null, 'Convert to PDF', 'Converting...');
    setWorkflowStage('processing');

    try {
        const pdfDoc = await PDFDocument.create();
        const failures = [];
        let pagesAdded = 0;

        for (let i = 0; i < selectedImages.length; i++) {
            cancellation.throwIfCancelled();

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
        if (isCancellation(error)) {
            showWarningMessage('Cancelled. No PDF was created, and your images are still listed.');
            setWorkflowStage('setup');
            return;
        }

        console.error('Error converting to PDF:', error);
        showErrorMessage(error.message || 'Failed to convert images to PDF.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        cancellation = null;
        resetStopButton();
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
