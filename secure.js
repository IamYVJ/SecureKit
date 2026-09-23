// ============================================
// SECURE PDF - PASSWORD PROTECTION
// SecureKit - Client-Side PDF Processing
// ============================================

let selectedFiles = [];
let isProcessing = false;
let workflowStage = 'setup';
let lastProtectionResult = null;
/*
 * Protecting a batch holds two things at once:
 *
 *   - every encrypted result, kept until the end so the files can be saved or
 *     zipped together. AES-256 output is the same size as its input, so this
 *     is the batch's total size.
 *   - the working set of the file currently being encrypted. Measured on a
 *     16.5 MB PDF, that peaked at 3.7x the file's size; 4 leaves some headroom.
 *
 * Only one file is encrypted at a time, so the working set is driven by the
 * largest file rather than the total.
 */
const ENCRYPTION_WORKING_SET_FACTOR = 4;

let securePdfModulePromise = null;
let encryptionUnavailableReason = null;
let cancellation = null;
let resetStopButton = () => {};

// PDF 1.7, Table 22: the /P bitmask. A set bit allows the action; bits not listed
// here are reserved and fixed by the encryption library. "All allowed" is the
// default, which matches how the tool behaved before permissions existed.
const PERMISSION_BITS = [
    { id: 'permPrint', bit: 1 << 2, label: 'printing' },
    { id: 'permModify', bit: 1 << 3, label: 'editing content' },
    { id: 'permCopy', bit: 1 << 4, label: 'copying text and images' },
    { id: 'permAnnotate', bit: 1 << 5, label: 'comments and annotations' },
    { id: 'permForms', bit: 1 << 8, label: 'filling in forms' },
    { id: 'permAccessibility', bit: 1 << 9, label: 'screen reader access' },
    { id: 'permAssemble', bit: 1 << 10, label: 'extracting or reordering pages' },
    { id: 'permPrintHighRes', bit: 1 << 11, label: 'high-quality printing' }
];

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
const downloadModeSelect = document.getElementById('downloadMode');
const showPasswordsCheckbox = document.getElementById('showPasswords');
const permissionInputs = new Map(
    PERMISSION_BITS.map((entry) => [entry.id, document.getElementById(entry.id)])
);
const printCheckbox = permissionInputs.get('permPrint');
const printHighResCheckbox = permissionInputs.get('permPrintHighRes');
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
const stopButton = document.getElementById('stopButton');
const insecureContextAlert = document.getElementById('insecureContextAlert');
const insecureContextMessage = document.getElementById('insecureContextMessage');
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
    printCheckbox?.addEventListener('change', updatePrintPermissionState);
    updatePrintPermissionState();

    if (accordionToggle && accordionContent) {
        setupAccordion(accordionToggle, accordionContent);
    }

    resetStopButton = setupStopButton(stopButton, () => cancellation?.cancel());
} catch (error) {
    console.error('Error setting up event listeners:', error);
    showErrorMessage('Failed to initialize the Secure PDF tool. Please refresh the page.');
}

setupDragAndDrop(uploadArea, (files) => {
    addFiles(files);
}, { allowMultiple: true });

/**
 * AES-256 encryption runs on the Web Crypto API, which browsers only expose to
 * secure origins. Detect that at load so people are told up front instead of
 * after picking files and typing a password.
 */
function checkEncryptionAvailability() {
    if (globalThis.crypto?.subtle) {
        return null;
    }

    if (window.isSecureContext === false) {
        const origin = window.location.protocol === 'file:'
            ? 'a local file'
            : window.location.origin;

        return `This page is served from ${origin}, and browsers only provide the `
            + 'encryption API SecureKit needs on a secure origin. Open it over '
            + '<strong>https://</strong> or <strong>http://localhost</strong> to protect PDFs.';
    }

    return 'This browser does not provide the Web Crypto API that AES-256 encryption '
        + 'needs. Please try a current version of Chrome, Edge, Firefox or Safari.';
}

function applyEncryptionAvailability() {
    encryptionUnavailableReason = checkEncryptionAvailability();

    if (!encryptionUnavailableReason) {
        return;
    }

    if (insecureContextMessage) {
        insecureContextMessage.innerHTML = encryptionUnavailableReason;
    }

    if (insecureContextAlert) {
        insecureContextAlert.hidden = false;
    }

    if (protectButton) {
        protectButton.disabled = true;
        protectButton.setAttribute('aria-disabled', 'true');
    }
}

applyEncryptionAvailability();

// The banner carries <strong> markup; toasts are plain text.
function stripMarkup(html) {
    return html.replace(/<[^>]*>/g, '');
}

function updatePasswordVisibility() {
    const inputType = showPasswordsCheckbox?.checked ? 'text' : 'password';
    [openPasswordInput, confirmPasswordInput, ownerPasswordInput].forEach((input) => {
        if (input) {
            input.type = inputType;
        }
    });
}

// High-quality printing is a qualifier on the print bit: with printing denied
// outright it has nothing to qualify, so keep the two in step.
function updatePrintPermissionState() {
    if (!printCheckbox || !printHighResCheckbox) {
        return;
    }

    const printingAllowed = printCheckbox.checked;
    printHighResCheckbox.disabled = !printingAllowed;

    if (!printingAllowed) {
        printHighResCheckbox.checked = false;
    }

    printHighResCheckbox.closest('.checkbox-label')?.classList.toggle('is-disabled', !printingAllowed);
}

function buildPermissionMask() {
    let mask = 0;
    const denied = [];

    PERMISSION_BITS.forEach((entry) => {
        const input = permissionInputs.get(entry.id);

        // A missing checkbox must not silently deny the action.
        if (!input || input.checked) {
            mask |= entry.bit;
        } else {
            denied.push(entry.label);
        }
    });

    return { mask, denied };
}

function resetPermissionInputs() {
    permissionInputs.forEach((input) => {
        if (input) {
            input.checked = true;
            input.disabled = false;
        }
    });

    updatePrintPermissionState();
}

function resetSensitiveInputs() {
    openPasswordInput.value = '';
    confirmPasswordInput.value = '';
    ownerPasswordInput.value = '';
    filenameSuffixInput.value = 'protected';
    showPasswordsCheckbox.checked = false;
    resetPermissionInputs();
    updatePasswordVisibility();
}

async function loadSecurePdfModule() {
    if (!securePdfModulePromise) {
        securePdfModulePromise = import('./lib/pdf-aes256.js')
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

/**
 * Estimate peak memory for protecting a set of files.
 *
 * @param {Array} items - Objects carrying a `size` in bytes
 * @returns {number} - Estimated peak bytes
 */
function estimateProtectionMemory(items) {
    const total = items.reduce((sum, item) => sum + (item.size || 0), 0);
    const largest = items.reduce((max, item) => Math.max(max, item.size || 0), 0);

    return total + (largest * ENCRYPTION_WORKING_SET_FACTOR);
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
            const combined = [...selectedFiles, ...validFiles];

            const totalValidation = validateTotalSize(combined);
            if (!totalValidation.valid) {
                showErrorMessage(totalValidation.error);
                return;
            }

            // The other tools check this too; encryption is just as hungry, and
            // it holds every result until the batch finishes.
            const budget = checkMemoryBudget(
                estimateProtectionMemory(combined),
                'Protect them in smaller batches.');

            if (!budget.ok) {
                showErrorMessage(budget.error);
                return;
            }

            if (budget.warning) {
                showWarningMessage(budget.warning);
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

const sections = {
    upload: uploadSection,
    files: filesSection,
    processing: processingSection,
    completion: completionSection,
    info: infoSection
};

function setupHandler() {
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
}

function updateUI() {
    applyWorkflowStage(workflowStage, sections, { setupHandler });
}

function setWorkflowStage(stage) {
    workflowStage = stage;
    applyWorkflowStage(stage, sections, { setupHandler, scrollOnTransition: true });
}

function renderFilesList() {
    filesList.textContent = '';

    selectedFiles.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'file-item';
        row.setAttribute('role', 'listitem');

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
        const index = selectedFiles.findIndex((file) => file.id === fileId);
        const removed = selectedFiles[index];
        selectedFiles = selectedFiles.filter((file) => file.id !== fileId);
        updateUI();

        if (removed) {
            announce(`${removed.name} removed. ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} selected.`);
        }
        focusAfterRemoval(filesList, index, '.file-remove', addMoreButton);
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

    const { mask, denied } = buildPermissionMask();

    // Restrictions are checked by the reader against the *user* password. Without a
    // distinct owner password the open password is also the owner password, so the
    // reader hands over full rights and the restrictions mean nothing.
    if (denied.length > 0 && !ownerPassword) {
        showWarningMessage(
            'Set an owner password to make the permission restrictions stick. '
            + 'Without one, the open password also unlocks full access.'
        );
    }

    return {
        openPassword,
        ownerPassword: ownerPassword || undefined,
        filenameSuffix: suffixValue,
        permissions: mask,
        deniedPermissions: denied
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

// The labels themselves contain "and" ("comments and annotations"), so a serial
// "x, y and z" reads worse than a plain comma list here.
function formatDeniedList(denied) {
    return denied.join(', ');
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

    const denied = lastProtectionResult.deniedPermissions || [];
    const permissionsNote = document.createElement('div');
    permissionsNote.className = 'completion-note';

    if (denied.length === 0) {
        permissionsNote.innerHTML = '<strong>Permissions:</strong> Printing, copying, editing, and the other document actions all stay allowed.';
    } else if (lastProtectionResult.ownerPasswordSet) {
        permissionsNote.innerHTML = `<strong>Permissions restricted:</strong> ${escapeHtml(formatDeniedList(denied))}. PDF readers enforce this for anyone opening with the open password; the owner password still grants full access.`;
    } else {
        permissionsNote.innerHTML = `<strong>Permissions restricted, but not enforceable:</strong> ${escapeHtml(formatDeniedList(denied))} marked as not allowed. Because no separate owner password was set, the open password also grants owner access, so readers will ignore the restrictions.`;
    }

    completionDetails.appendChild(permissionsNote);

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

        // Belt and braces: the button is already disabled, but the run must
        // not start even if something re-enables it.
        if (encryptionUnavailableReason) {
            showErrorMessage(stripMarkup(encryptionUnavailableReason));
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
        cancellation = createCancellation();
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
            cancellation.throwIfCancelled();

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
                    options.ownerPassword,
                    options.permissions
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
            ownerPasswordSet: Boolean(options.ownerPassword),
            deniedPermissions: options.deniedPermissions
        };

        renderCompletion();
        setWorkflowStage('completed');

        if (failedFiles.length > 0) {
            showWarningMessage(`Protected ${protectedFiles.length} of ${selectedFiles.length} files.`);
        } else {
            showSuccessMessage(`Protected ${protectedFiles.length} file${protectedFiles.length === 1 ? '' : 's'} successfully.`);
        }
    } catch (error) {
        if (isCancellation(error)) {
            showWarningMessage('Cancelled. Nothing was protected, and your files are still listed.');
            setWorkflowStage('setup');
            return;
        }
        console.error('Error in protectPDFs:', error);
        showErrorMessage(error.message || 'An error occurred while protecting PDFs. Please try again.');
        setWorkflowStage('setup');
    } finally {
        isProcessing = false;
        cancellation = null;
        resetStopButton();
        setProcessingState(false, protectButton, null, 'Protect PDFs', 'Protecting...');
    }
}

async function saveProtectedFiles() {
    try {
        if (!lastProtectionResult?.files?.length) {
            showWarningMessage('No protected files are ready to save yet.');
            return;
        }

        const mode = downloadModeSelect?.value || 'zip';

        // One file is a plain download whichever mode is selected - zipping a
        // single PDF only adds a step for the user.
        if (mode === 'zip' && lastProtectionResult.files.length > 1) {
            const archiveBase = sanitizeFilename(getDefaultFilename('ProtectedPDFs'));
            const result = await downloadAsZip(
                lastProtectionResult.files.map((file) => ({
                    filename: file.filename.endsWith('.pdf') ? file.filename : `${file.filename}.pdf`,
                    bytes: file.bytes
                })),
                archiveBase
            );

            if (result.failed > 0) {
                showWarningMessage(`Archive ready, but ${result.failed} file${result.failed !== 1 ? 's' : ''} could not be added.`);
            }

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
