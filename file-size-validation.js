// ============================================
// FILE SIZE VALIDATION MODULE
// SecureKit - Client-Side PDF Processing
// ============================================

// Configuration - Easily customizable
const FILE_SIZE_CONFIG = {
    MAX_SINGLE_FILE: 50 * 1024 * 1024,      // 50 MB per file
    MAX_TOTAL_MERGE: 200 * 1024 * 1024,     // 200 MB total for merge
    WARNING_SIZE: 20 * 1024 * 1024,         // 20 MB - show performance warning
    RECOMMENDED_MAX: 10 * 1024 * 1024,      // 10 MB - recommended size
    MEMORY_MULTIPLIER: 3                     // Estimate 3x file size for memory
};

// ============================================
// FILE SIZE VALIDATION
// ============================================

/**
 * Validate individual file size
 * @param {File} file - File object to validate
 * @param {boolean} showWarning - Whether to return warnings for large files
 * @returns {Object} - { valid: boolean, error: string|null, warning: string|null }
 */
function validateFileSize(file, showWarning = true) {
    const fileSize = file.size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

    // Check if file exceeds maximum allowed size
    if (fileSize > FILE_SIZE_CONFIG.MAX_SINGLE_FILE) {
        const maxSizeMB = (FILE_SIZE_CONFIG.MAX_SINGLE_FILE / (1024 * 1024)).toFixed(0);
        return {
            valid: false,
            error: `File "${file.name}" is too large (${fileSizeMB} MB). Maximum allowed: ${maxSizeMB} MB`,
            warning: null
        };
    }

    // Show warnings for large files if requested
    if (showWarning) {
        if (fileSize > FILE_SIZE_CONFIG.WARNING_SIZE) {
            return {
                valid: true,
                error: null,
                warning: `Large file detected (${fileSizeMB} MB). Processing may take longer.`
            };
        }

        if (fileSize > FILE_SIZE_CONFIG.RECOMMENDED_MAX) {
            const recommendedMB = (FILE_SIZE_CONFIG.RECOMMENDED_MAX / (1024 * 1024)).toFixed(0);
            return {
                valid: true,
                error: null,
                warning: `For best performance, files under ${recommendedMB} MB are recommended.`
            };
        }
    }

    return {
        valid: true,
        error: null,
        warning: null
    };
}

/**
 * Validate total size of multiple files (for merge operations)
 * @param {Array} files - Array of file objects with sizeBytes property
 * @returns {Object} - { valid: boolean, error: string|null, totalSize: number }
 */
function validateTotalSize(files) {
    const totalSize = files.reduce((sum, file) => {
        return sum + (file.sizeBytes || file.size || file.file?.size || 0);
    }, 0);

    if (totalSize > FILE_SIZE_CONFIG.MAX_TOTAL_MERGE) {
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        const maxSizeMB = (FILE_SIZE_CONFIG.MAX_TOTAL_MERGE / (1024 * 1024)).toFixed(0);

        return {
            valid: false,
            error: `Total file size (${totalSizeMB} MB) exceeds maximum allowed (${maxSizeMB} MB). Please remove some files.`,
            totalSize: totalSize
        };
    }

    return {
        valid: true,
        error: null,
        totalSize: totalSize
    };
}

// ============================================
// MEMORY ESTIMATION
// ============================================

/**
 * Estimate memory usage for processing a file
 * @param {number} fileSize - File size in bytes
 * @returns {number} - Estimated memory usage in bytes
 */
function estimateMemoryUsage(fileSize) {
    // PDF processing typically requires 2-3x the file size in memory
    return fileSize * FILE_SIZE_CONFIG.MEMORY_MULTIPLIER;
}

/**
 * Check if browser has enough available memory
 * @param {number} requiredMemory - Required memory in bytes
 * @returns {Object} - { hasEnough: boolean, warning: string|null }
 */
function checkAvailableMemory(requiredMemory) {
    // Check if Performance Memory API is available
    if (performance.memory) {
        const availableMemory = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
        const requiredMB = (requiredMemory / (1024 * 1024)).toFixed(1);

        if (availableMemory < requiredMemory) {
            return {
                hasEnough: false,
                warning: `Insufficient memory. This operation requires approximately ${requiredMB} MB of available memory.`
            };
        }

        // Warn if using more than 70% of available memory
        if (requiredMemory > availableMemory * 0.7) {
            return {
                hasEnough: true,
                warning: `This operation may use significant memory (${requiredMB} MB). Close other tabs if you experience issues.`
            };
        }
    }

    // If we can't check memory, assume it's okay but warn for very large files
    const requiredMB = (requiredMemory / (1024 * 1024)).toFixed(1);
    if (requiredMemory > 150 * 1024 * 1024) { // 150 MB
        return {
            hasEnough: true,
            warning: `Processing large file (estimated ${requiredMB} MB memory usage). This may take a while.`
        };
    }

    return {
        hasEnough: true,
        warning: null
    };
}

// ============================================
// STORAGE QUOTA CHECK
// ============================================

/**
 * Check if browser has enough storage quota for download
 * @param {number} requiredSpace - Required space in bytes
 * @returns {Promise<Object>} - { hasSpace: boolean, available: number }
 */
async function checkStorageQuota(requiredSpace) {
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const available = estimate.quota - estimate.usage;

            if (available < requiredSpace) {
                return {
                    hasSpace: false,
                    available: available
                };
            }

            return {
                hasSpace: true,
                available: available
            };
        }
    } catch (error) {
        console.warn('Storage quota check failed:', error);
    }

    // If we can't check, assume it's okay
    return {
        hasSpace: true,
        available: null
    };
}

// ============================================
// USER FEEDBACK FUNCTIONS
// ============================================

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
    // Remove any existing messages
    const existing = document.getElementById('validation-error-message');
    if (existing) {
        existing.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.id = 'validation-error-message';
    errorDiv.className = 'validation-message validation-error';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #1a1a1a;
        border: 2px solid #ff4444;
        border-radius: 12px;
        padding: 16px 24px;
        color: #f0f6fc;
        font-size: 15px;
        font-weight: 500;
        z-index: 10000;
        max-width: 90%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        animation: slideDown 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    errorDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color: #ff4444; flex-shrink: 0;">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M15 9l-6 6m0-6l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span style="white-space: pre-line;">${escapeHtml(message)}</span>
    `;

    document.body.appendChild(errorDiv);

    // Auto-remove after 6 seconds
    setTimeout(() => {
        errorDiv.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => errorDiv.remove(), 300);
    }, 6000);
}

/**
 * Show warning message to user
 * @param {string} message - Warning message to display
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
function showWarningMessage(message, duration = 5000) {
    // Remove any existing warning messages
    const existing = document.getElementById('validation-warning-message');
    if (existing) {
        existing.remove();
    }

    const warningDiv = document.createElement('div');
    warningDiv.id = 'validation-warning-message';
    warningDiv.className = 'validation-message validation-warning';
    warningDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #ff9800;
        border-radius: 12px;
        padding: 16px 24px;
        color: #000000;
        font-size: 15px;
        font-weight: 600;
        z-index: 10000;
        max-width: 90%;
        box-shadow: 0 8px 32px rgba(255, 152, 0, 0.4);
        animation: slideDown 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    warningDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color: #000000; flex-shrink: 0;">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/>
            <path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>${escapeHtml(message)}</span>
    `;

    document.body.appendChild(warningDiv);

    // Auto-remove after specified duration
    setTimeout(() => {
        warningDiv.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => warningDiv.remove(), 300);
    }, duration);
}

// ============================================
// BROWSER COMPATIBILITY CHECK
// ============================================

/**
 * Check if browser supports required features
 * @returns {Object} - { supported: boolean, missingFeatures: array }
 */
function checkBrowserCompatibility() {
    const requiredFeatures = {
        'File API': typeof File !== 'undefined',
        'FileReader': typeof FileReader !== 'undefined',
        'ArrayBuffer': typeof ArrayBuffer !== 'undefined',
        'Blob': typeof Blob !== 'undefined',
        'Promise': typeof Promise !== 'undefined'
    };

    const missingFeatures = [];

    for (const [feature, supported] of Object.entries(requiredFeatures)) {
        if (!supported) {
            missingFeatures.push(feature);
        }
    }

    return {
        supported: missingFeatures.length === 0,
        missingFeatures: missingFeatures
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================
// INITIALIZATION
// ============================================

// Log module load
console.log('✅ File Size Validation Module Loaded');
console.log('   Max Single File:', formatFileSize(FILE_SIZE_CONFIG.MAX_SINGLE_FILE));
console.log('   Max Total (Merge):', formatFileSize(FILE_SIZE_CONFIG.MAX_TOTAL_MERGE));
console.log('   Warning Size:', formatFileSize(FILE_SIZE_CONFIG.WARNING_SIZE));
