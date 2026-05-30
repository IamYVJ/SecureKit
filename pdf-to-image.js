// ============================================
// PDF TO IMAGE - SecureKit
// Renders PDF pages to JPG/PNG via pdf.js
// ============================================

const PDF_JS_WORKER_URL = 'lib/pdf.worker.min.js';
const MAX_RENDER_PIXELS = 16_000_000;

let selectedFile = null;
let pdfDocCache = null;
let isProcessing = false;
let workflowStage = 'setup';
let lastResult = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const uploadSection = document.getElementById('uploadSection');
const fileSection = document.getElementById('fileSection');
const fileDisplay = document.getElementById('fileDisplay');
const removeButton = document.getElementById('removeButton');
const cancelButton = document.getElementById('cancelButton');
const convertButton = document.getElementById('convertButton');
const customPagesInput = document.getElementById('customPages');
const renderScaleSelect = document.getElementById('renderScale');
const jpegQualitySelect = document.getElementById('jpegQuality');
const jpegQualityGroup = document.getElementById('jpegQualityGroup');
const baseFilenameInput = document.getElementById('baseFilename');
const downloadModeSelect = document.getElementById('downloadMode');
const accordionToggle = document.getElementById('accordionToggle');
const accordionContent = document.getElementById('accordionContent');
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

try {
    if (typeof pdfjsLib === 'undefined') {
        throw new Error('pdf.js failed to load');
    }
    if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;
    }

    browseButton?.addEventListener('click', () => fileInput.click());

    uploadArea?.addEventListener('click', (e) => {
        if (!browseButton?.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    removeButton?.addEventListener('click', clearFile);
    cancelButton?.addEventListener('click', clearFile);
    convertButton?.addEventListener('click', convertToImages);
    saveButton?.addEventListener('click', saveResult);
    anotherButton?.addEventListener('click', startAnother);

    setupAccordion(accordionToggle, accordionContent);
    setupRadioButtons('pageMode', (e) => handleRadioToggle(e, '.radio-input-wrapper'));
    setupRadioButtons('format', updateFormatVisibility);

    if (baseFilenameInput) {
        baseFilenameInput.value = getDefaultFilename('PDFImages');
    }

    updateFormatVisibility();
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the converter. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => {
    if (files.length > 0) handleFile(files[0]);
}, { allowMultiple: false });

function updateFormatVisibility() {
    const format = document.querySelector('input[name="format"]:checked')?.value || 'jpg';
    if (jpegQualityGroup) {
        jpegQualityGroup.style.display = format === 'jpg' ? 'block' : 'none';
    }
}

function handleFileSelect(e) {
    if (isProcessing) {
        showWarningMessage('Please wait for the current operation to complete.');
        return;
    }
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    fileInput.value = '';
}

async function handleFile(file) {
    if (!isPDF(file)) {
        showErrorMessage(`"${file.name}" is not a PDF file`);
        return;
    }

    const validation = validateFileSize(file, true);
    if (!validation.valid) {
        showErrorMessage(validation.error);
        return;
    }
    if (validation.warning) {
        showWarningMessage(validation.warning);
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            isEvalSupported: false
        }).promise;

        selectedFile = {
            file,
            name: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            pageCount: pdfDoc.numPages
        };
        pdfDocCache = pdfDoc;
        renderFileDisplay();
        updateUI();
    } catch (error) {
        console.error('Error loading PDF:', error);
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('password')) {
            showErrorMessage('This PDF is password-protected. Remove the password and try again.');
        } else {
            showErrorMessage('Could not load this PDF. It may be corrupted or invalid.');
        }
    }
}

function clearFile() {
    selectedFile = null;
    if (pdfDocCache) {
        pdfDocCache.destroy?.();
        pdfDocCache = null;
    }
    lastResult = null;
    updateUI();
}

function renderFileDisplay() {
    if (!fileDisplay || !selectedFile) return;

    fileDisplay.innerHTML = `
        <div class="file-item">
            <div class="file-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>
            <div class="file-info">
                <div class="file-name">${escapeHtml(selectedFile.name)}</div>
                <div class="file-details">${selectedFile.sizeFormatted} - ${selectedFile.pageCount} page${selectedFile.pageCount !== 1 ? 's' : ''}</div>
            </div>
        </div>
    `;
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

function clampRenderScale(baseViewport, desiredScale) {
    const basePixels = baseViewport.width * baseViewport.height;
    if (!basePixels || basePixels <= 0) return desiredScale;

    const desiredPixels = basePixels * desiredScale * desiredScale;
    if (desiredPixels <= MAX_RENDER_PIXELS) return desiredScale;

    return Math.max(0.5, Math.sqrt(MAX_RENDER_PIXELS / basePixels));
}

async function renderPageToBlob(pdfDoc, pageNumber, scale, format, jpegQuality) {
    const page = await pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const renderScale = clampRenderScale(baseViewport, scale);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const ctx = canvas.getContext('2d', {
        alpha: format === 'png'
    });
    if (!ctx) throw new Error('Unable to create canvas context');

    if (format !== 'png') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => {
        if (format === 'png') {
            canvas.toBlob(resolve, mimeType);
        } else {
            canvas.toBlob(resolve, mimeType, jpegQuality);
        }
    });

    canvas.width = 0;
    canvas.height = 0;
    page.cleanup?.();

    if (!blob) throw new Error('Failed to encode image');
    return { blob, renderScale, width: viewport.width, height: viewport.height };
}

async function convertToImages() {
    if (isProcessing) {
        showWarningMessage('Conversion already in progress.');
        return;
    }
    if (!selectedFile || !pdfDocCache) {
        showErrorMessage('Please select a PDF file first.');
        return;
    }

    const format = document.querySelector('input[name="format"]:checked')?.value || 'jpg';
    const pageMode = document.querySelector('input[name="pageMode"]:checked')?.value || 'all';
    const scale = parseFloat(renderScaleSelect?.value || '2') || 2;
    const jpegQuality = parseFloat(jpegQualitySelect?.value || '0.9') || 0.9;

    let pagesToExport;
    if (pageMode === 'custom') {
        const input = customPagesInput?.value?.trim() || '';
        if (!input) {
            showErrorMessage('Please enter page numbers to export.');
            return;
        }
        const parsed = parsePageSelection(input, selectedFile.pageCount);
        if (parsed.error) {
            showErrorMessage(parsed.error);
            return;
        }
        pagesToExport = parsed.pages;
    } else {
        pagesToExport = [];
        for (let i = 1; i <= selectedFile.pageCount; i++) pagesToExport.push(i);
    }

    const baseFilename = sanitizeFilename(baseFilenameInput?.value?.trim() || getDefaultFilename('PDFImages'))
        || getDefaultFilename('PDFImages');
    const ext = format === 'png' ? 'png' : 'jpg';

    isProcessing = true;
    setProcessingState(true, convertButton, null, 'Convert to Images', 'Converting...');
    setWorkflowStage('processing');

    const images = [];
    const failures = [];
    let totalSize = 0;

    try {
        for (let i = 0; i < pagesToExport.length; i++) {
            const pageNumber = pagesToExport[i];
            updateProgress(i + 1, pagesToExport.length, `Rendering page ${pageNumber}`, `Format: ${ext.toUpperCase()} at ${scale}x scale`);

            try {
                const result = await renderPageToBlob(pdfDocCache, pageNumber, scale, format, jpegQuality);
                const filename = `${baseFilename}_page${pageNumber}.${ext}`;
                images.push({
                    blob: result.blob,
                    filename,
                    pageNumber,
                    size: result.blob.size,
                    width: Math.round(result.width),
                    height: Math.round(result.height)
                });
                totalSize += result.blob.size;
            } catch (error) {
                console.error('Error rendering page', pageNumber, error);
                failures.push({ pageNumber, error: error.message || 'Render failed' });
            }

            await new Promise((r) => setTimeout(r, 0));
        }

        if (images.length === 0) {
            throw new Error('No pages could be rendered.');
        }

        showCompletion({
            images,
            failures,
            totalSize,
            format: ext,
            baseFilename
        });
    } catch (error) {
        console.error('Error converting PDF:', error);
        showErrorMessage(error.message || 'Failed to convert PDF to images.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, convertButton, null, 'Convert to Images', 'Converting...');
    }
}

function updateProgress(pageIndex, totalCount, message, stats) {
    updateProgressUI(progressElements, pageIndex, totalCount, message, stats);
}

function resetProgress() {
    resetProgressUI(progressElements, {
        title: 'Converting pages to images...',
        message: 'Please wait while we render your PDF'
    });
}

function showCompletion(result) {
    lastResult = result;

    if (completionTitle) completionTitle.textContent = 'Images Ready';
    if (completionSummary) {
        completionSummary.textContent = `Rendered ${result.images.length} page${result.images.length !== 1 ? 's' : ''} as ${result.format.toUpperCase()}.`;
    }

    if (completionStats) {
        completionStats.innerHTML = [
            { label: 'Images', value: String(result.images.length) },
            { label: 'Format', value: result.format.toUpperCase() },
            { label: 'Total Size', value: formatFileSize(result.totalSize) }
        ].map((item) => `
            <div class="completion-stat">
                <span class="completion-stat-label">${escapeHtml(item.label)}</span>
                <span class="completion-stat-value">${escapeHtml(item.value)}</span>
            </div>
        `).join('');
    }

    if (completionDetails) {
        const notes = ['<div class="completion-note"><strong>Done:</strong> Click <em>Save Images</em> to download. Your browser may ask permission to download multiple files.</div>'];
        if (result.failures.length > 0) {
            notes.push(`<div class="completion-note"><strong>Skipped:</strong> ${result.failures.length} page${result.failures.length !== 1 ? 's' : ''} could not be rendered.</div>`);
            const list = result.failures.map((f) => `
                <div class="completion-list-item">
                    <strong>Page ${f.pageNumber}</strong>
                    <span>${escapeHtml(f.error)}</span>
                </div>
            `).join('');
            notes.push(`<div class="completion-list">${list}</div>`);
        }
        const previewList = result.images.slice(0, 12).map((img) => `
            <div class="completion-list-item">
                <strong>${escapeHtml(img.filename)}</strong>
                <span>${img.width}x${img.height} - ${formatFileSize(img.size)}</span>
            </div>
        `).join('');
        notes.push(`<div class="completion-list">${previewList}</div>`);
        if (result.images.length > 12) {
            notes.push(`<div class="completion-note">... and ${result.images.length - 12} more</div>`);
        }
        completionDetails.innerHTML = notes.join('');
    }

    setWorkflowStage('completed');
}

async function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

async function saveResult() {
    if (!lastResult || lastResult.images.length === 0) {
        showWarningMessage('No images are ready to save.');
        return;
    }

    const mode = downloadModeSelect?.value || 'zip';

    try {
        if (mode === 'zip') {
            const archiveBase = sanitizeFilename(lastResult.baseFilename) || getDefaultFilename('PDFImages');
            const items = lastResult.images.map((img) => ({
                filename: img.filename,
                blob: img.blob
            }));
            const result = await downloadAsZip(items, archiveBase);
            if (result.failed > 0) {
                showWarningMessage(`Archive ready, but ${result.failed} image${result.failed !== 1 ? 's' : ''} could not be added.`);
            }
            return;
        }

        let failed = 0;
        for (let i = 0; i < lastResult.images.length; i++) {
            const img = lastResult.images[i];
            try {
                await downloadBlob(img.blob, img.filename);
                if (i < lastResult.images.length - 1) {
                    await new Promise((r) => setTimeout(r, 120));
                }
            } catch (error) {
                console.error('Download failed for', img.filename, error);
                failed++;
            }
        }
        if (failed > 0) {
            showWarningMessage(`${failed} download${failed !== 1 ? 's' : ''} failed.`);
        }
    } catch (error) {
        console.error('Error saving images:', error);
        showErrorMessage(error.message || 'Failed to save the images.');
    }
}

function startAnother() {
    lastResult = null;
    clearFile();
    if (baseFilenameInput) baseFilenameInput.value = getDefaultFilename('PDFImages');
    setWorkflowStage('setup');
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, convertButton, null, 'Convert to Images', 'Converting...');
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

console.log('PDF to Image module loaded.');
