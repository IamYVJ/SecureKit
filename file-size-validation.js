// ============================================
// FILE SIZE VALIDATION MODULE - ENHANCED
// SecureKit - Client-Side PDF Processing
// Enhanced Error Handling & Reliability
// ============================================

// Configuration - Easily customizable
const FILE_SIZE_CONFIG = {
    MAX_SINGLE_FILE: 50 * 1024 * 1024,      // 50 MB per file
    MAX_TOTAL_MERGE: 200 * 1024 * 1024,     // 200 MB total for merge
    WARNING_SIZE: 20 * 1024 * 1024,         // 20 MB - show performance warning
    RECOMMENDED_MAX: 10 * 1024 * 1024,      // 10 MB - recommended size
    MEMORY_MULTIPLIER: 3,                    // Estimate 3x file size for memory
    MESSAGE_DURATION_ERROR: 6000,            // 6 seconds for errors
    MESSAGE_DURATION_WARNING: 5000,          // 5 seconds for warnings
    MESSAGE_DURATION_SUCCESS: 3000           // 3 seconds for success
};

// Global error tracking
let activeMessages = new Set();
let errorCount = 0;

// ============================================
// FILE SIZE VALIDATION
// ============================================

/**
 * Validate individual file size with enhanced error handling
 * @param {File} file - File object to validate
 * @param {boolean} showWarning - Whether to return warnings for large files
 * @returns {Object} - { valid: boolean, error: string|null, warning: string|null }
 */
function validateFileSize(file, showWarning = true) {
    try {
        // Validate input
        if (!file) {
            return {
                valid: false,
                error: 'No file provided for validation',
                warning: null
            };
        }

        if (!(file instanceof File)) {
            return {
                valid: false,
                error: 'Invalid file object',
                warning: null
            };
        }

        // Check if file has size property
        if (typeof file.size !== 'number' || file.size < 0) {
            return {
                valid: false,
                error: 'Unable to determine file size. The file may be corrupted.',
                warning: null
            };
        }

        // Check for zero-size files
        if (file.size === 0) {
            return {
                valid: false,
                error: `File "${file.name}" is empty (0 bytes). Please select a valid PDF file.`,
                warning: null
            };
        }

        const fileSize = file.size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

        // Check if file exceeds maximum allowed size
        if (fileSize > FILE_SIZE_CONFIG.MAX_SINGLE_FILE) {
            const maxSizeMB = (FILE_SIZE_CONFIG.MAX_SINGLE_FILE / (1024 * 1024)).toFixed(0);
            return {
                valid: false,
                error: `File "${file.name}" is too large (${fileSizeMB} MB).\nMaximum allowed: ${maxSizeMB} MB.\nPlease compress or split the file before uploading.`,
                warning: null
            };
        }

        // Show warnings for large files if requested
        if (showWarning) {
            if (fileSize > FILE_SIZE_CONFIG.WARNING_SIZE) {
                return {
                    valid: true,
                    error: null,
                    warning: `Large file detected (${fileSizeMB} MB). Processing may take longer and use more memory.`
                };
            }

            if (fileSize > FILE_SIZE_CONFIG.RECOMMENDED_MAX) {
                const recommendedMB = (FILE_SIZE_CONFIG.RECOMMENDED_MAX / (1024 * 1024)).toFixed(0);
                return {
                    valid: true,
                    error: null,
                    warning: `For optimal performance, files under ${recommendedMB} MB are recommended.`
                };
            }
        }

        return {
            valid: true,
            error: null,
            warning: null
        };

    } catch (error) {
        console.error('Error in validateFileSize:', error);
        return {
            valid: false,
            error: 'An error occurred while validating the file. Please try again.',
            warning: null
        };
    }
}

/**
 * Validate total size of multiple files (for merge operations)
 * @param {Array} files - Array of file objects with sizeBytes property
 * @returns {Object} - { valid: boolean, error: string|null, totalSize: number }
 */
function validateTotalSize(files) {
    try {
        if (!Array.isArray(files)) {
            return {
                valid: false,
                error: 'Invalid files array provided',
                totalSize: 0
            };
        }

        if (files.length === 0) {
            return {
                valid: true,
                error: null,
                totalSize: 0
            };
        }

        const totalSize = files.reduce((sum, file) => {
            const fileSize = file.sizeBytes || file.size || file.file?.size || 0;
            if (typeof fileSize !== 'number' || fileSize < 0) {
                console.warn('Invalid file size detected:', file);
                return sum;
            }
            return sum + fileSize;
        }, 0);

        if (totalSize > FILE_SIZE_CONFIG.MAX_TOTAL_MERGE) {
            const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
            const maxSizeMB = (FILE_SIZE_CONFIG.MAX_TOTAL_MERGE / (1024 * 1024)).toFixed(0);

            return {
                valid: false,
                error: `Total file size (${totalSizeMB} MB) exceeds maximum allowed (${maxSizeMB} MB).\nPlease remove some files or split them into smaller batches.`,
                totalSize: totalSize
            };
        }

        return {
            valid: true,
            error: null,
            totalSize: totalSize
        };

    } catch (error) {
        console.error('Error in validateTotalSize:', error);
        return {
            valid: false,
            error: 'An error occurred while calculating total file size.',
            totalSize: 0
        };
    }
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
    try {
        if (typeof fileSize !== 'number' || fileSize < 0) {
            console.warn('Invalid file size for memory estimation:', fileSize);
            return 0;
        }

        // PDF processing typically requires 2-3x the file size in memory
        return fileSize * FILE_SIZE_CONFIG.MEMORY_MULTIPLIER;

    } catch (error) {
        console.error('Error in estimateMemoryUsage:', error);
        return fileSize * 3; // Default fallback
    }
}

/**
 * Check if browser has enough available memory
 * @param {number} requiredMemory - Required memory in bytes
 * @returns {Object} - { hasEnough: boolean, warning: string|null }
 */
function checkAvailableMemory(requiredMemory) {
    try {
        if (typeof requiredMemory !== 'number' || requiredMemory < 0) {
            return {
                hasEnough: true,
                warning: null
            };
        }

        // Check if Performance Memory API is available
        if (performance && performance.memory) {
            try {
                const availableMemory = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
                const requiredMB = (requiredMemory / (1024 * 1024)).toFixed(1);
                const availableMB = (availableMemory / (1024 * 1024)).toFixed(1);

                if (availableMemory < requiredMemory) {
                    return {
                        hasEnough: false,
                        warning: `Insufficient memory. This operation requires approximately ${requiredMB} MB, but only ${availableMB} MB is available.\nPlease close other tabs or applications and try again.`
                    };
                }

                // Warn if using more than 70% of available memory
                if (requiredMemory > availableMemory * 0.7) {
                    return {
                        hasEnough: true,
                        warning: `This operation may use significant memory (${requiredMB} MB of ${availableMB} MB available).\nClose other tabs if you experience issues.`
                    };
                }
            } catch (memoryError) {
                console.warn('Memory API check failed:', memoryError);
            }
        }

        // If we can't check memory, warn for very large files
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

    } catch (error) {
        console.error('Error in checkAvailableMemory:', error);
        return {
            hasEnough: true,
            warning: null
        };
    }
}

// ============================================
// STORAGE QUOTA CHECK
// ============================================

/**
 * Check if browser has enough storage quota for download
 * @param {number} requiredSpace - Required space in bytes
 * @returns {Promise<Object>} - { hasSpace: boolean, available: number, error: string|null }
 */
async function checkStorageQuota(requiredSpace) {
    try {
        if (typeof requiredSpace !== 'number' || requiredSpace < 0) {
            return {
                hasSpace: true,
                available: null,
                error: null
            };
        }

        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                const available = estimate.quota - estimate.usage;
                const requiredMB = (requiredSpace / (1024 * 1024)).toFixed(1);
                const availableMB = (available / (1024 * 1024)).toFixed(1);

                if (available < requiredSpace) {
                    return {
                        hasSpace: false,
                        available: available,
                        error: `Insufficient storage space. Need ${requiredMB} MB, but only ${availableMB} MB available.\nPlease free up space and try again.`
                    };
                }

                return {
                    hasSpace: true,
                    available: available,
                    error: null
                };
            } catch (storageError) {
                console.warn('Storage quota check failed:', storageError);
            }
        }
    } catch (error) {
        console.error('Error in checkStorageQuota:', error);
    }

    // If we can't check, assume it's okay
    return {
        hasSpace: true,
        available: null,
        error: null
    };
}

// ============================================
// USER FEEDBACK FUNCTIONS - ENHANCED
// ============================================

/**
 * Show error message to user with enhanced error handling
 * @param {string} message - Error message to display
 * @param {number} duration - Duration in milliseconds
 */
function showErrorMessage(message, duration = FILE_SIZE_CONFIG.MESSAGE_DURATION_ERROR) {
    try {
        if (!message || typeof message !== 'string') {
            console.error('Invalid error message:', message);
            return;
        }

        // Track error count for debugging
        errorCount++;
        console.error(`[Error #${errorCount}]:`, message);

        // Remove any existing error messages
        const existing = document.getElementById('validation-error-message');
        if (existing) {
            try {
                existing.remove();
                activeMessages.delete('error');
            } catch (e) {
                console.warn('Failed to remove existing error message:', e);
            }
        }

        const errorDiv = document.createElement('div');
        errorDiv.id = 'validation-error-message';
        errorDiv.className = 'validation-message validation-error';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.setAttribute('aria-live', 'assertive');
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
            align-items: flex-start;
            gap: 12px;
        `;

        errorDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color: #ff4444; flex-shrink: 0; margin-top: 2px;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M15 9l-6 6m0-6l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span style="white-space: pre-line; flex: 1;">${escapeHtml(message)}</span>
        `;

        document.body.appendChild(errorDiv);
        activeMessages.add('error');

        // Auto-remove after duration
        setTimeout(() => {
            try {
                if (errorDiv && errorDiv.parentNode) {
                    errorDiv.style.animation = 'slideUp 0.3s ease-out';
                    setTimeout(() => {
                        if (errorDiv.parentNode) {
                            errorDiv.remove();
                            activeMessages.delete('error');
                        }
                    }, 300);
                }
            } catch (e) {
                console.warn('Failed to remove error message:', e);
            }
        }, duration);

    } catch (error) {
        console.error('Failed to show error message:', error);
        // Fallback to alert if DOM manipulation fails
        try {
            alert('Error: ' + message);
        } catch (alertError) {
            console.error('Even alert failed:', alertError);
        }
    }
}

/**
 * Show warning message to user with enhanced error handling
 * @param {string} message - Warning message to display
 * @param {number} duration - Duration in milliseconds
 */
function showWarningMessage(message, duration = FILE_SIZE_CONFIG.MESSAGE_DURATION_WARNING) {
    try {
        if (!message || typeof message !== 'string') {
            console.warn('Invalid warning message:', message);
            return;
        }

        console.warn('[Warning]:', message);

        // Remove any existing warning messages
        const existing = document.getElementById('validation-warning-message');
        if (existing) {
            try {
                existing.remove();
                activeMessages.delete('warning');
            } catch (e) {
                console.warn('Failed to remove existing warning:', e);
            }
        }

        const warningDiv = document.createElement('div');
        warningDiv.id = 'validation-warning-message';
        warningDiv.className = 'validation-message validation-warning';
        warningDiv.setAttribute('role', 'alert');
        warningDiv.setAttribute('aria-live', 'polite');
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
            align-items: flex-start;
            gap: 12px;
        `;

        warningDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color: #000000; flex-shrink: 0; margin-top: 2px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2"/>
                <path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span style="flex: 1;">${escapeHtml(message)}</span>
        `;

        document.body.appendChild(warningDiv);
        activeMessages.add('warning');

        // Auto-remove after duration
        setTimeout(() => {
            try {
                if (warningDiv && warningDiv.parentNode) {
                    warningDiv.style.animation = 'slideUp 0.3s ease-out';
                    setTimeout(() => {
                        if (warningDiv.parentNode) {
                            warningDiv.remove();
                            activeMessages.delete('warning');
                        }
                    }, 300);
                }
            } catch (e) {
                console.warn('Failed to remove warning message:', e);
            }
        }, duration);

    } catch (error) {
        console.error('Failed to show warning message:', error);
    }
}

/**
 * Show success message to user
 * @param {string} message - Success message to display
 * @param {number} duration - Duration in milliseconds
 */
function showSuccessMessage(message, duration = FILE_SIZE_CONFIG.MESSAGE_DURATION_SUCCESS) {
    try {
        if (!message || typeof message !== 'string') {
            console.warn('Invalid success message:', message);
            return;
        }

        console.log('[Success]:', message);

        const successDiv = document.createElement('div');
        successDiv.className = 'validation-message validation-success';
        successDiv.setAttribute('role', 'status');
        successDiv.setAttribute('aria-live', 'polite');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #2dff8f;
            border-radius: 12px;
            padding: 16px 24px;
            color: #000000;
            font-size: 15px;
            font-weight: 600;
            z-index: 10000;
            max-width: 90%;
            box-shadow: 0 8px 32px rgba(45, 255, 143, 0.4);
            animation: slideDown 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        successDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color: #000000; flex-shrink: 0;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>${escapeHtml(message)}</span>
        `;

        document.body.appendChild(successDiv);

        setTimeout(() => {
            try {
                if (successDiv && successDiv.parentNode) {
                    successDiv.style.animation = 'slideUp 0.3s ease-out';
                    setTimeout(() => {
                        if (successDiv.parentNode) {
                            successDiv.remove();
                        }
                    }, 300);
                }
            } catch (e) {
                console.warn('Failed to remove success message:', e);
            }
        }, duration);

    } catch (error) {
        console.error('Failed to show success message:', error);
    }
}

// ============================================
// BROWSER COMPATIBILITY CHECK
// ============================================

/**
 * Check if browser supports required features
 * @returns {Object} - { supported: boolean, missingFeatures: array }
 */
function checkBrowserCompatibility() {
    try {
        const requiredFeatures = {
            'File API': typeof File !== 'undefined',
            'FileReader': typeof FileReader !== 'undefined',
            'ArrayBuffer': typeof ArrayBuffer !== 'undefined',
            'Blob': typeof Blob !== 'undefined',
            'Promise': typeof Promise !== 'undefined',
            'Async/Await': (function() {
                try {
                    eval('(async () => {})');
                    return true;
                } catch (e) {
                    return false;
                }
            })()
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

    } catch (error) {
        console.error('Error in checkBrowserCompatibility:', error);
        return {
            supported: false,
            missingFeatures: ['Unable to check compatibility']
        };
    }
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
    try {
        if (typeof text !== 'string') {
            text = String(text);
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;

    } catch (error) {
        console.error('Error in escapeHtml:', error);
        // Fallback: basic escaping
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
    try {
        if (typeof bytes !== 'number' || bytes < 0) {
            return '0 Bytes';
        }

        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        if (i < 0 || i >= sizes.length) {
            return bytes + ' Bytes';
        }

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];

    } catch (error) {
        console.error('Error in formatFileSize:', error);
        return bytes + ' Bytes';
    }
}

/**
 * Clear all active validation messages
 */
function clearAllMessages() {
    try {
        const errorMsg = document.getElementById('validation-error-message');
        const warningMsg = document.getElementById('validation-warning-message');

        if (errorMsg) errorMsg.remove();
        if (warningMsg) warningMsg.remove();

        activeMessages.clear();
    } catch (error) {
        console.error('Error clearing messages:', error);
    }
}

// ============================================
// INITIALIZATION
// ============================================

// Log module load
try {
    console.log('✅ File Size Validation Module Loaded (Enhanced)');
    console.log('   Max Single File:', formatFileSize(FILE_SIZE_CONFIG.MAX_SINGLE_FILE));
    console.log('   Max Total (Merge):', formatFileSize(FILE_SIZE_CONFIG.MAX_TOTAL_MERGE));
    console.log('   Warning Size:', formatFileSize(FILE_SIZE_CONFIG.WARNING_SIZE));

    // Check browser compatibility on load
    const compat = checkBrowserCompatibility();
    if (!compat.supported) {
        console.error('❌ Browser compatibility issues detected:', compat.missingFeatures);
    }
} catch (error) {
    console.error('Error during validation module initialization:', error);
}
