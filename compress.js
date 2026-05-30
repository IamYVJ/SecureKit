// ============================================
// COMPRESS PDF - IMAGE + STRUCTURAL OPTIMIZATION
// SecureKit - Client-Side PDF Processing
// ============================================

const { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFNumber } = PDFLib;

const STRUCTURAL_PRESETS = {
    low: { objectsPerTick: 50, useObjectStreams: true },
    medium: { objectsPerTick: 25, useObjectStreams: true },
    high: { objectsPerTick: 10, useObjectStreams: true }
};

const IMAGE_PRESETS = {
    low: { renderScale: 1.35, jpegQuality: 0.82, label: 'image-based (low)' },
    medium: { renderScale: 1.1, jpegQuality: 0.66, label: 'image-based (medium)' },
    high: { renderScale: 0.85, jpegQuality: 0.48, label: 'image-based (high)' }
};

// Non-destructive image recompression: re-encodes embedded JPEG XObjects only.
// Preserves text, vector content, forms, links, metadata.
const SMART_RECOMPRESS_PRESETS = {
    low:    [{ jpegQuality: 0.85, maxDimension: null, label: 'smart-recompress (low)' }],
    medium: [{ jpegQuality: 0.70, maxDimension: 2400, label: 'smart-recompress (medium)' }],
    high:   [{ jpegQuality: 0.50, maxDimension: 1600, label: 'smart-recompress (high)' }]
};

const SMART_RECOMPRESS_CUSTOM_ATTEMPTS = [
    { jpegQuality: 0.85, maxDimension: null, label: 'smart-recompress 1' },
    { jpegQuality: 0.75, maxDimension: 2400, label: 'smart-recompress 2' },
    { jpegQuality: 0.65, maxDimension: 2000, label: 'smart-recompress 3' },
    { jpegQuality: 0.55, maxDimension: 1600, label: 'smart-recompress 4' },
    { jpegQuality: 0.45, maxDimension: 1200, label: 'smart-recompress 5' }
];

const MAX_RENDER_PIXELS = 8_000_000;

let selectedFiles = [];
let isProcessing = false;
let workflowStage = 'setup';
let lastCompressionResult = null;
const PENDING_COMPRESS_STORAGE_KEY = 'securekit.pendingCompressFile';

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
const processingTitle = document.getElementById('processingTitle');
const processingMessage = document.getElementById('processingMessage');
const progressInfo = document.getElementById('progressInfo');
const currentFile = document.getElementById('currentFile');
const totalFiles = document.getElementById('totalFiles');
const compressionStats = document.getElementById('compressionStats');
const completionSection = document.getElementById('completionSection');
const completionTitle = document.getElementById('completionTitle');
const completionSummary = document.getElementById('completionSummary');
const completionStats = document.getElementById('completionStats');
const completionDetails = document.getElementById('completionDetails');
const saveButton = document.getElementById('saveButton');
const anotherButton = document.getElementById('anotherButton');
const infoSection = document.querySelector('.info-section');
const PDF_JS_WORKER_URL = 'lib/pdf.worker.min.js';

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
    addMoreButton?.addEventListener('click', () => fileInput.click());
    clearButton?.addEventListener('click', clearAllFiles);
    compressButton?.addEventListener('click', compressPDFs);
    saveButton?.addEventListener('click', saveCompressionResults);
    anotherButton?.addEventListener('click', startAnotherCompression);

    setupRadioButtons('compressionLevel', (e) => {
        handleRadioToggle(e, '.option-input-wrapper');
    });
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the compression tool. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => {
    addFiles(files);
}, { allowMultiple: true });

function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function importPendingCompressionFile() {
    try {
        const rawPayload = sessionStorage.getItem(PENDING_COMPRESS_STORAGE_KEY);
        if (!rawPayload) {
            return;
        }

        sessionStorage.removeItem(PENDING_COMPRESS_STORAGE_KEY);
        const payload = JSON.parse(rawPayload);
        if (!payload?.bytesBase64 || !payload?.filename) {
            return;
        }

        const bytes = base64ToUint8Array(payload.bytesBase64);
        const file = new File([bytes], payload.filename, {
            type: payload.mimeType || 'application/pdf'
        });

        addFiles([file]);
        showSuccessMessage(`Loaded "${payload.filename}" from the merge tool. Ready to compress.`);
    } catch (error) {
        console.error('Error importing pending compression file:', error);
        sessionStorage.removeItem(PENDING_COMPRESS_STORAGE_KEY);
        showErrorMessage('Could not load the merged file into the compression tool automatically.');
    }
}

importPendingCompressionFile();

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

        files.forEach((file) => {
            try {
                if (!isPDF(file)) {
                    errors.push(`"${file.name}" is not a PDF file`);
                    return;
                }

                const validation = validateFileSize(file, true);
                if (!validation.valid) {
                    errors.push(validation.error);
                    return;
                }

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
    statsEl: compressionStats,
    currentEl: currentFile,
    totalEl: totalFiles,
    infoEl: progressInfo
};

function setupHandler() {
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

function updateUI() {
    applyWorkflowStage(workflowStage, sections, { setupHandler });
}

function setWorkflowStage(stage) {
    workflowStage = stage;
    applyWorkflowStage(stage, sections, { setupHandler, scrollOnTransition: true });
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
        lastCompressionResult = null;
        updateUI();
    } catch (error) {
        console.error('Error clearing files:', error);
        showErrorMessage('Failed to clear files. Please try again.');
    }
}

function updateProgress(fileIndex, totalCount, message, stats = '') {
    updateProgressUI(progressElements, fileIndex, totalCount, message, stats);
}

function resetProgress() {
    resetProgressUI(progressElements, {
        title: 'Compressing PDFs...',
        message: 'Please wait while we evaluate the best compression path for your files'
    });
}

function renderCompletionStats(items) {
    if (!completionStats) {
        return;
    }

    completionStats.innerHTML = items.map((item) => `
        <div class="completion-stat">
            <span class="completion-stat-label">${escapeHtml(item.label)}</span>
            <span class="completion-stat-value">${escapeHtml(item.value)}</span>
        </div>
    `).join('');
}

function renderCompletionDetails(notes, items) {
    if (!completionDetails) {
        return;
    }

    const noteMarkup = notes.map((note) => `<div class="completion-note">${note}</div>`).join('');
    const listMarkup = items.length > 0 ? `
        <div class="completion-list">
            ${items.map((item) => `
                <div class="completion-list-item">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.meta)}</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    completionDetails.innerHTML = noteMarkup + listMarkup;
}

function showCompressionCompletion(result) {
    lastCompressionResult = result;

    if (completionTitle) {
        completionTitle.textContent = 'Compressed Files Ready';
    }

    if (completionSummary) {
        completionSummary.textContent = `Processed ${result.files.length} file${result.files.length !== 1 ? 's' : ''} with a total size change of ${result.totalDeltaText}.`;
    }

    renderCompletionStats([
        { label: 'Files Ready', value: String(result.files.length) },
        { label: 'Original Total', value: formatFileSize(result.totalOriginalSize) },
        { label: 'Compressed Total', value: formatFileSize(result.totalCompressedSize) },
        { label: 'Size Change', value: result.totalDeltaText }
    ]);

    const notes = [
        '<strong>Done:</strong> Your compression results are ready to save.'
    ];

    if (result.smartRecompressedCount > 0) {
        const fileWord = result.smartRecompressedCount !== 1 ? 's' : '';
        const imgWord = result.totalImagesRecompressed !== 1 ? 'images' : 'image';
        notes.push(`<strong>Smart recompression:</strong> Re-encoded ${result.totalImagesRecompressed} ${imgWord} across ${result.smartRecompressedCount} file${fileWord}. Text, vectors, forms, and links were preserved.`);
    }

    if (result.flattenedCount > 0) {
        notes.push(`<strong>Heads up:</strong> ${result.flattenedCount} file${result.flattenedCount !== 1 ? 's were' : ' was'} flattened into images to reach a smaller size. Searchable text, links, and form fields may not survive in those files.`);
    }

    if (result.targetMisses > 0) {
        notes.push(`<strong>Target note:</strong> ${result.targetMisses} file${result.targetMisses !== 1 ? 's could' : ' could'} not reach the requested target size, so the smallest result was kept.`);
    }

    if (result.failedFiles.length > 0) {
        notes.push(`<strong>Attention:</strong> ${result.failedFiles.length} file${result.failedFiles.length !== 1 ? 's were' : ' was'} skipped during compression.`);
    }

    renderCompletionDetails(
        notes,
        [
            ...result.files.map((item) => ({
                title: `${item.filename}.pdf`,
                meta: `${formatFileSize(item.originalSize)} -> ${formatFileSize(item.compressedSize)}`
            })),
            ...result.failedFiles.map((item) => ({
                title: `${item.name} (skipped)`,
                meta: item.error
            }))
        ]
    );

    setWorkflowStage('completed');
}

async function saveCompressionResults() {
    if (!lastCompressionResult) {
        showWarningMessage('No compressed files are ready to save yet.');
        return;
    }

    try {
        const results = await downloadMultiplePDFs(
            lastCompressionResult.files.map((item) => ({
                bytes: item.bytes,
                filename: item.filename
            })),
            120
        );

        if (results.failed > 0) {
            showWarningMessage(`Started saving compressed files, but ${results.failed} download${results.failed !== 1 ? 's' : ''} failed.`);
        }
    } catch (error) {
        console.error('Error saving compressed files:', error);
        showErrorMessage(error.message || 'Failed to save the compressed PDFs.');
    }
}

function startAnotherCompression() {
    lastCompressionResult = null;
    clearAllFiles();
    setWorkflowStage('setup');
}

async function tryRecompressJpegStream(rawStream, jpegQuality, maxDimension) {
    const dict = rawStream.dict;

    const filter = dict.get(PDFName.of('Filter'));
    let filterName = null;
    if (!filter) {
        return null;
    } else if (filter instanceof PDFArray) {
        if (filter.size() !== 1) {
            return null;
        }
        filterName = filter.get(0)?.encodedName;
    } else {
        filterName = filter.encodedName;
    }
    if (filterName !== '/DCTDecode') {
        return null;
    }

    // Skip masked images: downscaling would desync the mask's coordinate space.
    if (dict.get(PDFName.of('SMask')) || dict.get(PDFName.of('Mask'))) {
        return null;
    }

    // Canvas re-encoding produces RGB. Skip color spaces we can't faithfully round-trip
    // (CMYK, ICCBased, Indexed, etc.).
    const colorSpace = dict.get(PDFName.of('ColorSpace'));
    if (colorSpace instanceof PDFArray) {
        return null;
    }
    const csName = colorSpace?.encodedName ?? null;
    if (csName && csName !== '/DeviceRGB' && csName !== '/DeviceGray') {
        return null;
    }

    const originalBytes = rawStream.contents;
    const originalSize = originalBytes?.length ?? 0;
    if (originalSize === 0) {
        return null;
    }

    let bitmap;
    try {
        const blob = new Blob([originalBytes], { type: 'image/jpeg' });
        bitmap = await createImageBitmap(blob);
    } catch (e) {
        return null;
    }

    let width = bitmap.width;
    let height = bitmap.height;
    if (maxDimension && Math.max(width, height) > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
        bitmap.close?.();
        return null;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const newBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', jpegQuality)
    );
    canvas.width = 0;
    canvas.height = 0;

    if (!newBlob) {
        return null;
    }

    const newBytes = new Uint8Array(await newBlob.arrayBuffer());
    if (newBytes.length >= originalSize) {
        return null;
    }

    const newDict = dict.clone();
    newDict.set(PDFName.of('Width'), PDFNumber.of(width));
    newDict.set(PDFName.of('Height'), PDFNumber.of(height));
    newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
    newDict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    newDict.delete(PDFName.of('DecodeParms'));
    newDict.delete(PDFName.of('Decode'));

    const newStream = PDFRawStream.of(newDict, newBytes);
    return { newStream, originalSize, newSize: newBytes.length };
}

async function recompressEmbeddedImages(arrayBuffer, options, fileIndex, totalCount, attemptLabel = '') {
    const { jpegQuality, maxDimension } = options;
    const pdfDoc = await PDFDocument.load(arrayBuffer.slice(0));
    const context = pdfDoc.context;

    const imageStreams = [];
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
        if (!(obj instanceof PDFRawStream)) continue;
        const subtype = obj.dict.get(PDFName.of('Subtype'));
        if (subtype?.encodedName === '/Image') {
            imageStreams.push([ref, obj]);
        }
    }

    if (imageStreams.length === 0) {
        return null;
    }

    let recompressed = 0;
    let savedBytes = 0;

    for (let i = 0; i < imageStreams.length; i++) {
        const [ref, obj] = imageStreams[i];

        updateProgress(
            fileIndex,
            totalCount,
            `Recompressing image ${i + 1} of ${imageStreams.length}${attemptLabel ? ` (${attemptLabel})` : ''}`,
            `JPEG quality ${Math.round(jpegQuality * 100)}%${maxDimension ? `, max ${maxDimension}px` : ', no resize'}`
        );

        try {
            const result = await tryRecompressJpegStream(obj, jpegQuality, maxDimension);
            if (result) {
                context.assign(ref, result.newStream);
                recompressed++;
                savedBytes += result.originalSize - result.newSize;
            }
        } catch (e) {
            console.warn('Image recompress skipped:', e.message);
        }

        if ((i & 3) === 3) {
            await new Promise((r) => setTimeout(r, 0));
        }
    }

    if (recompressed === 0) {
        return null;
    }

    const bytes = await pdfDoc.save({ useObjectStreams: true, objectsPerTick: 20 });
    return {
        bytes,
        recompressedImages: recompressed,
        totalImages: imageStreams.length,
        savedBytes
    };
}

async function optimizeStructurally(arrayBuffer, compressionLevel) {
    const pdfDoc = await PDFDocument.load(arrayBuffer.slice(0));
    const saveOptions = STRUCTURAL_PRESETS[compressionLevel] || STRUCTURAL_PRESETS.medium;
    return pdfDoc.save(saveOptions);
}

async function loadPdfJsDocument(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('PDF data is empty');
    }

    return pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        isEvalSupported: false
    }).promise;
}

function clampRenderScale(baseViewport, desiredScale) {
    const basePixels = baseViewport.width * baseViewport.height;
    if (!basePixels || basePixels <= 0) {
        return desiredScale;
    }

    const desiredPixels = basePixels * desiredScale * desiredScale;
    if (desiredPixels <= MAX_RENDER_PIXELS) {
        return desiredScale;
    }

    const maxScale = Math.sqrt(MAX_RENDER_PIXELS / basePixels);
    return Math.max(0.45, Math.min(desiredScale, maxScale));
}

async function canvasToJpegBytes(canvas, quality) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) {
        throw new Error('Failed to generate compressed image data.');
    }

    return new Uint8Array(await blob.arrayBuffer());
}

async function createImageCompressedPdf(pdfJsDoc, imageSettings, fileIndex, totalCount, attemptLabel = '') {
    const outputPdf = await PDFDocument.create();

    for (let pageNumber = 1; pageNumber <= pdfJsDoc.numPages; pageNumber++) {
        const page = await pdfJsDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const renderScale = clampRenderScale(baseViewport, imageSettings.renderScale);
        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });

        if (!context) {
            throw new Error('Unable to initialize canvas rendering.');
        }

        canvas.width = Math.max(1, Math.floor(renderViewport.width));
        canvas.height = Math.max(1, Math.floor(renderViewport.height));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        updateProgress(
            fileIndex,
            totalCount,
            `Rendering page ${pageNumber} of ${pdfJsDoc.numPages}${attemptLabel ? ` (${attemptLabel})` : ''}`,
            `JPEG quality ${Math.round(imageSettings.jpegQuality * 100)}% at ${renderScale.toFixed(2)}x scale`
        );

        await page.render({
            canvasContext: context,
            viewport: renderViewport
        }).promise;

        const jpgBytes = await canvasToJpegBytes(canvas, imageSettings.jpegQuality);
        const embeddedImage = await outputPdf.embedJpg(jpgBytes);
        const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);

        outputPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: baseViewport.width,
            height: baseViewport.height
        });

        canvas.width = 0;
        canvas.height = 0;
        page.cleanup?.();
    }

    return outputPdf.save({ useObjectStreams: true, objectsPerTick: 20 });
}

function createCustomAttempt(renderScale, jpegQuality, label) {
    return {
        renderScale: Number(renderScale.toFixed(3)),
        jpegQuality: Number(jpegQuality.toFixed(3)),
        label,
        qualityScore: Number(((renderScale * 0.7) + (jpegQuality * 0.3)).toFixed(4))
    };
}

function buildCustomImageAttempts() {
    const presets = [
        [1.5, 0.95],
        [1.4, 0.92],
        [1.3, 0.88],
        [1.2, 0.84],
        [1.1, 0.78],
        [1.0, 0.72],
        [0.92, 0.66],
        [0.84, 0.6],
        [0.76, 0.54],
        [0.68, 0.48],
        [0.6, 0.4],
        [0.52, 0.34],
        [0.44, 0.26],
        [0.36, 0.18]
    ];

    return presets.map(([renderScale, jpegQuality], index) =>
        createCustomAttempt(renderScale, jpegQuality, `attempt ${index + 1} of ${presets.length}`)
    );
}

function buildRefinedCustomAttempts(oversizedAttempt, undersizedAttempt, count = 4) {
    if (!oversizedAttempt || !undersizedAttempt) {
        return [];
    }

    const refinedAttempts = [];

    for (let step = 1; step <= count; step++) {
        const ratio = step / (count + 1);
        const renderScale = oversizedAttempt.renderScale + ((undersizedAttempt.renderScale - oversizedAttempt.renderScale) * ratio);
        const jpegQuality = oversizedAttempt.jpegQuality + ((undersizedAttempt.jpegQuality - oversizedAttempt.jpegQuality) * ratio);
        refinedAttempts.push(
            createCustomAttempt(renderScale, jpegQuality, `refinement ${step} of ${count}`)
        );
    }

    return refinedAttempts;
}

function buildPresetImageAttempts(level) {
    const presetAttempts = {
        low: [
            { renderScale: 1.2, jpegQuality: 0.82, label: 'image-based (low 1)' },
            { renderScale: 1.05, jpegQuality: 0.74, label: 'image-based (low 2)' },
            { renderScale: 0.92, jpegQuality: 0.66, label: 'image-based (low 3)' }
        ],
        medium: [
            { renderScale: 1.05, jpegQuality: 0.7, label: 'image-based (medium 1)' },
            { renderScale: 0.9, jpegQuality: 0.58, label: 'image-based (medium 2)' },
            { renderScale: 0.78, jpegQuality: 0.48, label: 'image-based (medium 3)' }
        ],
        high: [
            { renderScale: 0.9, jpegQuality: 0.56, label: 'image-based (high 1)' },
            { renderScale: 0.76, jpegQuality: 0.44, label: 'image-based (high 2)' },
            { renderScale: 0.64, jpegQuality: 0.34, label: 'image-based (high 3)' },
            { renderScale: 0.54, jpegQuality: 0.26, label: 'image-based (high 4)' }
        ]
    };

    const attempts = presetAttempts[level] || [IMAGE_PRESETS.medium];
    return attempts.map((attempt) => ({
        ...attempt,
        qualityScore: Number(((attempt.renderScale * 0.7) + (attempt.jpegQuality * 0.3)).toFixed(4))
    }));
}

function chooseSmallerResult(currentBest, candidate) {
    if (!candidate || !candidate.bytes || candidate.bytes.length === 0) {
        return currentBest;
    }

    if (!currentBest || candidate.bytes.length < currentBest.bytes.length) {
        return candidate;
    }

    return currentBest;
}

function chooseBestTargetResult(currentBest, candidate) {
    if (!candidate || !candidate.targetMet || !candidate.bytes || candidate.bytes.length === 0) {
        return currentBest;
    }

    if (!currentBest) {
        return candidate;
    }

    if (currentBest.flattened !== candidate.flattened) {
        return currentBest.flattened ? candidate : currentBest;
    }

    const currentQualityScore = currentBest.qualityScore ?? currentBest.bytes.length;
    const candidateQualityScore = candidate.qualityScore ?? candidate.bytes.length;

    if (candidateQualityScore > currentQualityScore) {
        return candidate;
    }

    if (candidateQualityScore === currentQualityScore && candidate.bytes.length > currentBest.bytes.length) {
        return candidate;
    }

    return currentBest;
}

async function compressSingleFile(fileData, compressionLevel, targetSizeBytes, fileIndex, totalCount) {
    const arrayBuffer = await fileData.file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty file');
    }

    const originalBytes = new Uint8Array(arrayBuffer.slice(0));
    const isTargetMode = compressionLevel === 'custom' && Boolean(targetSizeBytes);
    let bestResult = {
        bytes: originalBytes,
        method: 'original',
        flattened: false,
        qualityScore: Number.MAX_SAFE_INTEGER,
        targetMet: targetSizeBytes ? originalBytes.length <= targetSizeBytes : true
    };
    let bestTargetResult = isTargetMode
        ? chooseBestTargetResult(null, bestResult)
        : null;

    if (isTargetMode && bestTargetResult && !bestTargetResult.flattened) {
        return bestTargetResult;
    }

    updateProgress(fileIndex, totalCount, 'Running structural optimization...', `Original size: ${formatFileSize(originalBytes.length)}`);

    try {
        const structuralBytes = await optimizeStructurally(arrayBuffer, compressionLevel);
        if (structuralBytes?.length > 0) {
            const structuralCandidate = {
                bytes: structuralBytes,
                method: 'structural',
                flattened: false,
                qualityScore: Number.MAX_SAFE_INTEGER,
                targetMet: targetSizeBytes ? structuralBytes.length <= targetSizeBytes : true
            };

            bestResult = chooseSmallerResult(bestResult, structuralCandidate);
            bestTargetResult = chooseBestTargetResult(bestTargetResult, structuralCandidate);

            if (isTargetMode && bestTargetResult && !bestTargetResult.flattened) {
                return bestTargetResult;
            }

            if (!isTargetMode && targetSizeBytes && structuralBytes.length <= targetSizeBytes) {
                return bestResult;
            }
        }
    } catch (error) {
        console.warn('Structural optimization failed for', fileData.name, error);
    }

    const smartAttempts = compressionLevel === 'custom'
        ? SMART_RECOMPRESS_CUSTOM_ATTEMPTS
        : (SMART_RECOMPRESS_PRESETS[compressionLevel] || SMART_RECOMPRESS_PRESETS.medium);

    for (const smart of smartAttempts) {
        try {
            updateProgress(
                fileIndex,
                totalCount,
                'Smart image recompression: scanning for JPEG XObjects...',
                `Preserving text, vectors, forms, and metadata`
            );

            const smartResult = await recompressEmbeddedImages(
                arrayBuffer,
                smart,
                fileIndex,
                totalCount,
                smart.label
            );

            if (!smartResult || !smartResult.bytes || smartResult.bytes.length === 0) {
                break;
            }

            const candidate = {
                bytes: smartResult.bytes,
                method: smart.label,
                flattened: false,
                recompressed: true,
                recompressedImages: smartResult.recompressedImages,
                totalImages: smartResult.totalImages,
                qualityScore: Number.MAX_SAFE_INTEGER,
                targetMet: targetSizeBytes ? smartResult.bytes.length <= targetSizeBytes : true
            };

            bestResult = chooseSmallerResult(bestResult, candidate);
            bestTargetResult = chooseBestTargetResult(bestTargetResult, candidate);

            if (isTargetMode && bestTargetResult && !bestTargetResult.flattened && bestTargetResult.targetMet) {
                return bestTargetResult;
            }

            if (!isTargetMode && targetSizeBytes && candidate.targetMet) {
                return candidate;
            }
        } catch (error) {
            console.warn('Smart image recompression failed for', fileData.name, error);
            break;
        }
    }

    const imageAttempts = compressionLevel === 'custom'
        ? buildCustomImageAttempts()
        : buildPresetImageAttempts(compressionLevel);

    let pdfJsDoc;
    let previousOversizedAttempt = null;

    try {
        updateProgress(fileIndex, totalCount, 'Preparing image-based compression...', `Pages will be flattened into images if this path wins`);
        pdfJsDoc = await loadPdfJsDocument(arrayBuffer);

        for (const attempt of imageAttempts) {
            const candidateBytes = await createImageCompressedPdf(
                pdfJsDoc,
                attempt,
                fileIndex,
                totalCount,
                attempt.label || ''
            );

            if (!candidateBytes || candidateBytes.length === 0) {
                console.warn('Skipping empty image-compression result for', fileData.name, attempt.label || 'unnamed attempt');
                continue;
            }

            const candidate = {
                bytes: candidateBytes,
                method: attempt.label ? `image-targeted (${attempt.label})` : attempt.label || IMAGE_PRESETS[compressionLevel]?.label || 'image-based',
                flattened: true,
                qualityScore: attempt.qualityScore ?? 0,
                targetMet: targetSizeBytes ? candidateBytes.length <= targetSizeBytes : true
            };

            bestResult = chooseSmallerResult(bestResult, candidate);
            bestTargetResult = chooseBestTargetResult(bestTargetResult, candidate);

            if (isTargetMode && candidate.targetMet) {
                const refinedAttempts = buildRefinedCustomAttempts(previousOversizedAttempt, attempt);

                for (const refinedAttempt of refinedAttempts) {
                    const refinedBytes = await createImageCompressedPdf(
                        pdfJsDoc,
                        refinedAttempt,
                        fileIndex,
                        totalCount,
                        refinedAttempt.label
                    );

                    if (!refinedBytes || refinedBytes.length === 0) {
                        continue;
                    }

                    const refinedCandidate = {
                        bytes: refinedBytes,
                        method: `image-targeted (${refinedAttempt.label})`,
                        flattened: true,
                        qualityScore: refinedAttempt.qualityScore ?? 0,
                        targetMet: refinedBytes.length <= targetSizeBytes
                    };

                    bestResult = chooseSmallerResult(bestResult, refinedCandidate);
                    bestTargetResult = chooseBestTargetResult(bestTargetResult, refinedCandidate);
                }

                return bestTargetResult || candidate;
            }

            if (!isTargetMode && targetSizeBytes && candidate.targetMet) {
                return candidate;
            }

            if (isTargetMode && !candidate.targetMet) {
                previousOversizedAttempt = attempt;
            }
        }
    } finally {
        if (pdfJsDoc) {
            await pdfJsDoc.destroy();
        }
    }

    return bestTargetResult || bestResult;
}

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

        let targetSizeBytes = null;
        if (compressionLevel === 'custom') {
            const targetSizeValue = parseFloat(targetSize?.value);
            const unit = sizeUnit?.value || 'MB';

            if (isNaN(targetSizeValue) || targetSizeValue <= 0) {
                throw new Error('Please enter a valid target size greater than 0.');
            }

            targetSizeBytes = unit === 'MB'
                ? targetSizeValue * 1024 * 1024
                : targetSizeValue * 1024;
        }

        isProcessing = true;
        setProcessingState(true, compressButton, null, 'Compress PDFs', 'Compressing...');
        resetProgress();
        setWorkflowStage('processing');

        if (processingMessage && compressionLevel === 'custom') {
            processingMessage.textContent = 'Please wait while we create multiple compression versions and keep the best quality under your target size.';
        }

        const successfulCompressions = [];
        const failedCompressions = [];
        let flattenedCount = 0;
        let smartRecompressedCount = 0;
        let totalImagesRecompressed = 0;
        let targetMisses = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const fileData = selectedFiles[i];

            try {
                if (processingTitle) {
                    processingTitle.textContent = `Compressing ${i + 1} of ${selectedFiles.length}`;
                }

                const result = await compressSingleFile(
                    fileData,
                    compressionLevel,
                    targetSizeBytes,
                    i + 1,
                    selectedFiles.length
                );

                if (!result.bytes || result.bytes.length === 0) {
                    throw new Error('Compression produced an empty PDF');
                }

                const originalSize = fileData.size;
                const compressedSize = result.bytes.length;
                const reduction = originalSize > 0
                    ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
                    : '0.0';
                const baseName = fileData.name.replace(/\.pdf$/i, '');

                if (result.flattened) {
                    flattenedCount++;
                } else if (result.recompressed) {
                    smartRecompressedCount++;
                    totalImagesRecompressed += result.recompressedImages || 0;
                }

                if (targetSizeBytes && !result.targetMet) {
                    targetMisses++;
                }

                successfulCompressions.push({
                    bytes: result.bytes,
                    filename: `${baseName}_compressed`,
                    originalSize: originalSize,
                    compressedSize: compressedSize,
                    reduction: reduction,
                    method: result.method,
                    targetMet: result.targetMet
                });
            } catch (error) {
                console.error('Error compressing file:', fileData.name, error);
                failedCompressions.push({
                    name: fileData.name,
                    error: error.message || 'Compression failed'
                });
            }
        }

        if (successfulCompressions.length === 0) {
            throw new Error('No files could be compressed. Please check the files and try again.');
        }

        const summaryOriginalSize = successfulCompressions.reduce((sum, item) => sum + item.originalSize, 0);
        const summaryCompressedSize = successfulCompressions.reduce((sum, item) => sum + item.compressedSize, 0);
        const summaryDeltaPercent = summaryOriginalSize > 0
            ? (Math.abs(summaryOriginalSize - summaryCompressedSize) / summaryOriginalSize * 100).toFixed(1)
            : '0.0';
        const totalDeltaText = summaryCompressedSize <= summaryOriginalSize
            ? `${summaryDeltaPercent}% smaller`
            : `${summaryDeltaPercent}% larger`;

        showCompressionCompletion({
            files: successfulCompressions,
            failedFiles: failedCompressions,
            totalOriginalSize: summaryOriginalSize,
            totalCompressedSize: summaryCompressedSize,
            totalDeltaText,
            flattenedCount,
            smartRecompressedCount,
            totalImagesRecompressed,
            targetMisses
        });
    } catch (error) {
        console.error('Error compressing PDFs:', error);
        showErrorMessage(error.message || 'An error occurred while compressing PDFs. Please try again.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, compressButton, null, 'Compress PDFs', 'Compressing...');
    }
}

window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (isProcessing) {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, compressButton, null, 'Compress PDFs', 'Compressing...');
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (isProcessing) {
        isProcessing = false;
        resetProgress();
        setProcessingState(false, compressButton, null, 'Compress PDFs', 'Compressing...');
        setWorkflowStage('setup');
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
});

console.log('Compress PDF module loaded with structural and image-based optimization.');
