// ============================================
// SECURE PDF - PASSWORD PROTECTION
// SecureKit - Client-Side PDF Processing
// ============================================

let selectedFiles = [];
let isProcessing = false;
let workflowStage = 'setup';
let lastProtectionResult = null;
let securePdfModulePromise = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const uploadSection = document.getElementById('uploadSection');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const fileCount = document.getElementById('fileCount');
const totalSize = document.getElementById('totalSize');
const addMoreButton = document.getElementById('addMoreButton');
const clearButton = document.getElementById('clearButton');
const protectButton = document.getElementById('protectButton');
const openPasswordInput = document.getElementById('openPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const ownerPasswordInput = document.getElementById('ownerPassword');
const filenameSuffixInput = document.getElementById('filenameSuffix');
const showPasswordsCheckbox = document.getElementById('showPasswords');
const processingSection = document.getElementById('processingSection');
const processingTitle = document.getElementById('processingTitle');
const processingMessage = document.getElementById('processingMessage');
const progressInfo = document.getElementById('progressInfo');
const currentFile = document.getElementById('currentFile');
const totalFiles = document.getElementById('totalFiles');
const securityStats = document.getElementById('securityStats');
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

try {
    browseButton?.addEventListener('click', () => fileInput.click());

    uploadArea?.addEventListener('click', (e) => {
        if (!browseButton?.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput?.addEventListener('change', handleFileSelect);
    addMoreButton?.addEventListener('click', () => fileInput.click());
    clearButton?.addEventListener('click', clearAllFiles);
    protectButton?.addEventListener('click', protectPDFs);
    saveButton?.addEventListener('click', saveProtectedFiles);
    anotherButton?.addEventListener('click', startAnotherProtection);
    showPasswordsCheckbox?.addEventListener('change', updatePasswordVisibility);

    if (accordionToggle && accordionContent) {
        setupAccordion(accordionToggle, accordionContent);
    }
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the Secure PDF tool. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => {
    addFiles(files);
}, { allowMultiple: true });

function updatePasswordVisibility() {
    const inputType = showPasswordsCheckbox?.checked ? 'text' : 'password';
    [openPasswordInput, confirmPasswordInput, ownerPasswordInput].forEach((input) => {
        if (input) {
            input.type = inputType;
        }
    });
}

function resetSensitiveInputs() {
    openPasswordInput.value = '';
    confirmPasswordInput.value = '';
    ownerPasswordInput.value = '';
    filenameSuffixInput.value = 'protected';
    showPasswordsCheckbox.checked = false;
    updatePasswordVisibility();
}

async function loadSecurePdfModule() {
    if (!securePdfModulePromise) {
        securePdfModulePromise = import('https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-encrypt-lite@1.0.0/+esm')
            .then((module) => {
                if (typeof module.encryptPDF !== 'function') {
                    throw new Error('Secure PDF module loaded without encryption support.');
                }

                return module;
            });
    }

    return securePdfModulePromise;
}

function handleFileSelect(e) {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to complete.');
            return;
        }

        const files = Array.from(e.target.files || []);
        addFiles(files);
        fileInput.value = '';
    } catch (error) {
        console.error('Error in handleFileSelect:', error);
        showErrorMessage('An error occurred while selecting files. Please try again.');
        fileInput.value = '';
    }
}

async function addFiles(files) {
    try {
        if (!Array.isArray(files) || files.length === 0) {
            return;
        }

        const validFiles = [];
        const errors = [];

        for (const file of files) {
            try {
                if (!isPDF(file)) {
                    errors.push(`"${file.name}" is not a PDF file.`);
                    continue;
                }

                const validation = validateFileSize(file, true);
                if (!validation.valid) {
                    errors.push(validation.error);
                    continue;
                }

                if (validation.warning) {
                    showWarningMessage(validation.warning);
                }

                const result = await loadPDFWithValidation(file);
                if (result.error) {
                    errors.push(`"${file.name}": ${result.error}`);
                    continue;
                }

                validFiles.push({
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: file.size,
                    pageCount: result.pageCount
                });
            } catch (fileError) {
                console.error('Error validating file:', file.name, fileError);
                errors.push(`"${file.name}": could not be prepared for protection.`);
            }
        }

        if (validFiles.length > 0) {
            const totalValidation = validateTotalSize([...selectedFiles, ...validFiles]);
            if (!totalValidation.valid) {
                showErrorMessage(totalValidation.error);
                return;
            }

            selectedFiles.push(...validFiles);
            updateUI();
        }

        if (errors.length > 0) {
            showErrorMessage(errors.join('\n'));
        }
    } catch (error) {
        console.error('Error in addFiles:', error);
        showErrorMessage('An error occurred while adding files. Please try again.');
    }
}

function updateUI() {
    try {
        if (workflowStage === 'processing') {
            uploadSection.style.display = 'none';
            filesSection.style.display = 'none';
            processingSection.style.display = 'flex';
            completionSection.style.display = 'none';
            if (infoSection) {
                infoSection.style.display = 'none';
            }
            return;
        }

        if (workflowStage === 'completed') {
            uploadSection.style.display = 'none';
            filesSection.style.display = 'none';
            processingSection.style.display = 'none';
            completionSection.style.display = 'block';
            if (infoSection) {
                infoSection.style.display = 'none';
            }
            return;
        }

        processingSection.style.display = 'none';
        completionSection.style.display = 'none';

        if (infoSection) {
            infoSection.style.display = 'block';
        }

        if (selectedFiles.length > 0) {
            uploadSection.style.display = 'none';
            filesSection.style.display = 'block';
            fileCount.textContent = String(selectedFiles.length);
            totalSize.textContent = formatFileSize(
                selectedFiles.reduce((sum, file) => sum + file.size, 0)
            );
            renderFilesList();
        } else {
            uploadSection.style.display = 'block';
            filesSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating UI:', error);
        showErrorMessage('UI update failed. Please refresh the page.');
    }
}

function setWorkflowStage(stage) {
    workflowStage = stage;
    updateUI();

    if (stage === 'processing') {
        processingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (stage === 'completed') {
        completionSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderFilesList() {
    filesList.textContent = '';

    selectedFiles.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'file-item';

        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/>
                <path d="M14 2v6h6M9 14a3 3 0 0 1 6 0v4H9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        const info = document.createElement('div');
        info.className = 'file-info';

        const name = document.createElement('div');
        name.className = 'file-name';
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'file-meta';
        meta.textContent = `${formatFileSize(item.size)} • ${item.pageCount} ${item.pageCount === 1 ? 'page' : 'pages'}`;

        info.appendChild(name);
        info.appendChild(meta);

        const removeButton = document.createElement('button');
        removeButton.className = 'file-remove';
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label', `Remove ${item.name}`);
        removeButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        removeButton.addEventListener('click', () => removeFile(item.id));

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(removeButton);
        filesList.appendChild(row);
    });
}

function removeFile(fileId) {
    try {
        selectedFiles = selectedFiles.filter((file) => file.id !== fileId);
        updateUI();
    } catch (error) {
        console.error('Error removing file:', error);
        showErrorMessage('Failed to remove file. Please try again.');
    }
}

function clearAllFiles() {
    try {
        if (isProcessing) {
            showWarningMessage('Please wait for the current operation to finish.');
            return;
        }

        selectedFiles = [];
        lastProtectionResult = null;
        workflowStage = 'setup';
        updateUI();
    } catch (error) {
        console.error('Error clearing files:', error);
        showErrorMessage('Failed to clear files. Please try again.');
    }
}

function getProtectionOptions() {
    const openPassword = openPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const ownerPassword = ownerPasswordInput.value;
    const suffixValue = sanitizeFilename(filenameSuffixInput.value.trim()) || 'protected';

    if (!openPassword) {
        showErrorMessage('Please enter an open password.');
        return null;
    }

    if (openPassword.length < 4) {
        showErrorMessage('Please use an open password with at least 4 characters.');
        return null;
    }

    if (confirmPassword !== openPassword) {
        showErrorMessage('The password confirmation does not match.');
        return null;
    }

    if (ownerPassword && ownerPassword.length < 4) {
        showErrorMessage('If you use an owner password, please make it at least 4 characters.');
        return null;
    }

    return {
        openPassword,
        ownerPassword: ownerPassword || undefined,
        filenameSuffix: suffixValue
    };
}

function buildProtectedFilename(originalName, suffix) {
    const baseName = originalName.toLowerCase().endsWith('.pdf')
        ? originalName.slice(0, -4)
        : originalName;
    const safeBaseName = sanitizeFilename(baseName) || 'document';
    const safeSuffix = sanitizeFilename(suffix) || 'protected';
    return `${safeBaseName}_${safeSuffix}`;
}

function normalizeProtectionError(error) {
    const message = error?.message || 'Protection failed.';

    if (/password|encrypted/i.test(message)) {
        return 'This PDF is already password-protected or could not be re-protected.';
    }

    if (/empty/i.test(message)) {
        return 'The file could not be read correctly.';
    }

    return message;
}

function createCompletionStat(label, value) {
    const card = document.createElement('div');
    card.className = 'completion-stat';

    const statLabel = document.createElement('span');
    statLabel.className = 'completion-stat-label';
    statLabel.textContent = label;

    const statValue = document.createElement('span');
    statValue.className = 'completion-stat-value';
    statValue.textContent = value;

    card.appendChild(statLabel);
    card.appendChild(statValue);
    return card;
}

function renderCompletion() {
    if (!lastProtectionResult) {
        return;
    }

    const { files, inputTotal, outputTotal, totalPages, failed } = lastProtectionResult;

    completionTitle.textContent = files.length === 1 ? 'Protected PDF Ready' : 'Protected PDFs Ready';
    completionSummary.textContent = files.length === 1
        ? 'Password protection has been applied and your file is ready to save.'
        : `Password protection has been applied to ${files.length} files.`;

    saveButton.querySelector('span').textContent = files.length === 1 ? 'Save File' : 'Save Files';

    completionStats.textContent = '';
    completionStats.appendChild(createCompletionStat('Protected Files', String(files.length)));
    completionStats.appendChild(createCompletionStat('Total Pages', String(totalPages)));
    completionStats.appendChild(createCompletionStat('Input Size', formatFileSize(inputTotal)));
    completionStats.appendChild(createCompletionStat('Protected Size', formatFileSize(outputTotal)));

    completionDetails.textContent = '';

    const primaryNote = document.createElement('div');
    primaryNote.className = 'completion-note';
    primaryNote.innerHTML = '<strong>Open password enabled:</strong> Every saved PDF from this batch will prompt for the password before it opens.';
    completionDetails.appendChild(primaryNote);

    const ownerNote = document.createElement('div');
    ownerNote.className = 'completion-note';
    ownerNote.innerHTML = lastProtectionResult.ownerPasswordSet
        ? '<strong>Owner password added:</strong> A separate owner password was also written into the protected files.'
        : '<strong>Owner password not set:</strong> Only the open password was applied for this batch.';
    completionDetails.appendChild(ownerNote);

    if (failed.length > 0) {
        const failedNote = document.createElement('div');
        failedNote.className = 'completion-note';
        failedNote.innerHTML = `<strong>Some files were skipped:</strong> ${failed.length} file${failed.length === 1 ? '' : 's'} could not be protected in this run.`;
        completionDetails.appendChild(failedNote);
    }

    const list = document.createElement('div');
    list.className = 'completion-list';

    files.forEach((file) => {
        const row = document.createElement('div');
        row.className = 'completion-list-item';

        const name = document.createElement('strong');
        name.textContent = `${file.filename}.pdf`;

        const meta = document.createElement('span');
        meta.textContent = `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'} • ${formatFileSize(file.originalSize)} -> ${formatFileSize(file.outputSize)}`;

        row.appendChild(name);
        row.appendChild(meta);
        list.appendChild(row);
    });

    if (failed.length > 0) {
        failed.forEach((file) => {
            const row = document.createElement('div');
            row.className = 'completion-list-item';

            const name = document.createElement('strong');
            name.textContent = `${file.name} (not protected)`;

            const meta = document.createElement('span');
            meta.textContent = file.error;

            row.appendChild(name);
            row.appendChild(meta);
            list.appendChild(row);
        });
    }

    completionDetails.appendChild(list);
}

async function protectPDFs() {
    try {
        if (isProcessing) {
            showWarningMessage('Protection is already in progress. Please wait.');
            return;
        }

        if (selectedFiles.length === 0) {
            showErrorMessage('Please select at least one PDF file to protect.');
            return;
        }

        const options = getProtectionOptions();
        if (!options) {
            return;
        }

        isProcessing = true;
        lastProtectionResult = null;
        setProcessingState(true, protectButton, null, 'Protect PDFs', 'Protecting...');
        processingTitle.textContent = selectedFiles.length === 1 ? 'Protecting 1 PDF' : `Protecting ${selectedFiles.length} PDFs`;
        processingMessage.textContent = 'Loading the protection engine and preparing your files';
        progressInfo.style.display = 'block';
        totalFiles.textContent = String(selectedFiles.length);
        securityStats.textContent = 'Preparing protection settings';
        setWorkflowStage('processing');

        const { encryptPDF } = await loadSecurePdfModule();
        const protectedFiles = [];
        const failedFiles = [];
        let inputTotal = 0;
        let outputTotal = 0;
        let totalPages = 0;

        for (let index = 0; index < selectedFiles.length; index++) {
            const item = selectedFiles[index];

            currentFile.textContent = String(index + 1);
            processingMessage.textContent = `Applying password protection to ${item.name}`;
            securityStats.innerHTML = `Protecting <strong>${item.pageCount}</strong> ${item.pageCount === 1 ? 'page' : 'pages'} with the selected password`;

            try {
                const sourceBytes = new Uint8Array(await item.file.arrayBuffer());
                if (!sourceBytes.length) {
                    throw new Error('PDF data is empty.');
                }

                const result = await encryptPDF(
                    sourceBytes.slice(),
                    options.openPassword,
                    options.ownerPassword
                );

                const protectedBytes = result instanceof Uint8Array
                    ? result
                    : new Uint8Array(result);

                if (!protectedBytes.length) {
                    throw new Error('Protected PDF data is empty.');
                }

                protectedFiles.push({
                    bytes: protectedBytes,
                    filename: buildProtectedFilename(item.name, options.filenameSuffix),
                    originalName: item.name,
                    originalSize: item.size,
                    outputSize: protectedBytes.length,
                    pageCount: item.pageCount
                });

                inputTotal += item.size;
                outputTotal += protectedBytes.length;
                totalPages += item.pageCount;
            } catch (error) {
                console.error('Error protecting PDF:', item.name, error);
                failedFiles.push({
                    name: item.name,
                    error: normalizeProtectionError(error)
                });
            }
        }

        if (protectedFiles.length === 0) {
            throw new Error('No files could be protected. Please check the files and try again.');
        }

        lastProtectionResult = {
            files: protectedFiles,
            failed: failedFiles,
            inputTotal,
            outputTotal,
            totalPages,
            ownerPasswordSet: Boolean(options.ownerPassword)
        };

        renderCompletion();
        setWorkflowStage('completed');

        if (failedFiles.length > 0) {
            showWarningMessage(`Protected ${protectedFiles.length} of ${selectedFiles.length} files.`);
        } else {
            showSuccessMessage(`Protected ${protectedFiles.length} file${protectedFiles.length === 1 ? '' : 's'} successfully.`);
        }
    } catch (error) {
        console.error('Error in protectPDFs:', error);
        showErrorMessage(error.message || 'An error occurred while protecting PDFs. Please try again.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        setProcessingState(false, protectButton, null, 'Protect PDFs', 'Protecting...');
    }
}

async function saveProtectedFiles() {
    try {
        if (!lastProtectionResult?.files?.length) {
            showWarningMessage('No protected files are ready to save yet.');
            return;
        }

        const results = await downloadMultiplePDFs(lastProtectionResult.files, 120);

        if (results.failed > 0) {
            showWarningMessage(`Started saving protected files, but ${results.failed} download${results.failed === 1 ? '' : 's'} failed.`);
        }
    } catch (error) {
        console.error('Error saving protected PDFs:', error);
        showErrorMessage(error.message || 'Failed to save the protected PDFs.');
    }
}

function startAnotherProtection() {
    selectedFiles = [];
    lastProtectionResult = null;
    workflowStage = 'setup';
    resetSensitiveInputs();
    updateUI();
    uploadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

updatePasswordVisibility();
updateUI();
