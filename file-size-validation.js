// ============================================
// FILE SIZE VALIDATION MODULE - SECURITY ENHANCED
// SecureKit - Client-Side PDF Processing
// Enhanced XSS Prevention & Security Hardening
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
    MESSAGE_DURATION_SUCCESS: 5000           // 5 seconds for success
};

// Global error tracking
let activeMessages = new Set();
let errorCount = 0;

// Security: Allowed file extensions (whitelist approach)
const ALLOWED_FILE_EXTENSIONS = ['.pdf'];
const ALLOWED_MIME_TYPES = ['application/pdf'];

// Security: Maximum filename length
const MAX_FILENAME_LENGTH = 255;

// ============================================
// SECURITY UTILITIES
// ============================================

/**
 * Enhanced HTML escaping with comprehensive XSS prevention
 * @param {string} text - Text to escape
 * @returns {string} - Safely escaped text
 */
function escapeHtml(text) {
    try {
        if (text === null || text === undefined) {
            return '';
        }

        if (typeof text !== 'string') {
            text = String(text);
        }

        // Use DOMParser for safer escaping
        const div = document.createElement('div');
        div.textContent = text;
        const escaped = div.innerHTML;

        // Additional escaping for edge cases
        return escaped
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');

    } catch (error) {
        console.error('Error in escapeHtml:', error);
        // Fallback: Manual escaping
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
}

/**
 * Sanitize filename for security
 * Prevents: Path traversal, XSS, command injection
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
    try {
        if (!filename || typeof filename !== 'string') {
            return '';
        }

        // Remove .pdf extension if present (we'll add it back)
        let name = filename.replace(/\.pdf$/i, '');

        // Remove path separators (prevent path traversal)
        name = name.replace(/[\\/]/g, '');

        // Remove null bytes (prevent injection)
        name = name.replace(/\0/g, '');

        // Remove control characters
        name = name.replace(/[\x00-\x1F\x7F]/g, '');

        // Remove potentially dangerous characters
        // Allow only: alphanumeric, spaces, hyphens, underscores, periods
        name = name.replace(/[^a-zA-Z0-9\s._-]/g, '_');

        // Replace multiple spaces/underscores with single
        name = name.replace(/[_\s]+/g, '_');

        // Remove leading/trailing dots (security: hidden files on Unix)
        name = name.replace(/^\.+|\.+$/g, '');

        // Remove leading/trailing spaces and underscores
        name = name.replace(/^[_\s]+|[_\s]+$/g, '');

        // Prevent reserved filenames (Windows)
        const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 
                               'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 
                               'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reservedNames.includes(name.toUpperCase())) {
            name = '_' + name;
        }

        // Limit length
        if (name.length > MAX_FILENAME_LENGTH) {
            name = name.substring(0, MAX_FILENAME_LENGTH);
        }

        // If empty after sanitization, return empty (caller should use default)
        return name;

    } catch (error) {
        console.error('Error sanitizing filename:', error);
        return '';
    }
}

/**
 * Validate file extension (whitelist approach)
 * @param {string} filename - Filename to validate
 * @returns {boolean} - True if allowed extension
 */
function hasValidExtension(filename) {
    try {
        if (!filename || typeof filename !== 'string') {
            return false;
        }

        const lowerFilename = filename.toLowerCase();
        return ALLOWED_FILE_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));

    } catch (error) {
        console.error('Error validating extension:', error);
        return false;
    }
}

/**
 * Validate MIME type (whitelist approach)
 * @param {string} mimeType - MIME type to validate
 * @returns {boolean} - True if allowed MIME type
 */
function hasValidMimeType(mimeType) {
    try {
        if (!mimeType || typeof mimeType !== 'string') {
            return false;
        }

        return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());

    } catch (error) {
        console.error('Error validating MIME type:', error);
        return false;
    }
}

/**
 * Create safe DOM element with text content (prevents XSS)
 * @param {string} tagName - Element tag name
 * @param {string} textContent - Text content (will be escaped)
 * @param {Object} attributes - Attributes to set
 * @returns {HTMLElement} - Safely created element
 */
function createSafeElement(tagName, textContent = '', attributes = {}) {
    try {
        const element = document.createElement(tagName);

        // Use textContent (safe) instead of innerHTML
        if (textContent) {
            element.textContent = textContent;
        }

        // Safely set attributes (whitelist approach)
        const allowedAttributes = ['id', 'class', 'role', 'aria-live', 'aria-label', 'data-'];
        for (const [key, value] of Object.entries(attributes)) {
            if (allowedAttributes.some(allowed => key.startsWith(allowed))) {
                element.setAttribute(key, String(value));
            }
        }

        return element;

    } catch (error) {
        console.error('Error creating safe element:', error);
        return document.createElement('div');
    }
}

// ============================================
// FILE SIZE VALIDATION
// ============================================

/**
 * Validate individual file size with enhanced security
 * @param {File} file - File object to validate
 * @param {boolean} showWarning - Whether to return warnings for large files
 * @returns {Object} - { valid: boolean, error: string|null, warning: string|null }
 */
function validateFileSize(file, showWarning = true) {
    try {
        // Validate input (type checking for security)
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

        // Security: Validate file extension (whitelist)
        if (!hasValidExtension(file.name)) {
            return {
                valid: false,
                error: `Invalid file type. Only PDF files are allowed.`,
                warning: null
            };
        }

        // Security: Validate MIME type (whitelist)
        if (file.type && !hasValidMimeType(file.type)) {
            return {
                valid: false,
                error: `Invalid MIME type "${escapeHtml(file.type)}". Expected application/pdf.`,
                warning: null
            };
        }

        // Security: Validate filename length
        if (file.name.length > MAX_FILENAME_LENGTH) {
            return {
                valid: false,
                error: `Filename is too long (${file.name.length} characters). Maximum: ${MAX_FILENAME_LENGTH}.`,
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
                error: `File is empty (0 bytes). Please select a valid PDF file.`,
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
                error: `File is too large (${fileSizeMB} MB).\nMaximum allowed: ${maxSizeMB} MB.\nPlease compress or split the file before uploading.`,
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

        return fileSize * FILE_SIZE_CONFIG.MEMORY_MULTIPLIER;

    } catch (error) {
        console.error('Error in estimateMemoryUsage:', error);
        return fileSize * 3;
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

        const requiredMB = (requiredMemory / (1024 * 1024)).toFixed(1);
        if (requiredMemory > 150 * 1024 * 1024) {
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

    return {
        hasSpace: true,
        available: null,
        error: null
    };
}

// ============================================
// USER FEEDBACK FUNCTIONS - SECURITY ENHANCED
// ============================================

/**
 * Show error message with XSS prevention
 * @param {string} message - Error message to display
 * @param {number} duration - Duration in milliseconds
 */
function showErrorMessage(message, duration = FILE_SIZE_CONFIG.MESSAGE_DURATION_ERROR) {
    try {
        if (!message || typeof message !== 'string') {
            console.error('Invalid error message:', message);
            return;
        }

        errorCount++;
        console.error(`[Error #${errorCount}]:`, message);

        const existing = document.getElementById('validation-error-message');
        if (existing) {
            try {
                existing.remove();
                activeMessages.delete('error');
            } catch (e) {
                console.warn('Failed to remove existing error message:', e);
            }
        }

        // Create element using safe method
        const errorDiv = createSafeElement('div', '', {
            id: 'validation-error-message',
            class: 'validation-message validation-error',
            role: 'alert',
            'aria-live': 'assertive'
        });

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

        // Create icon SVG safely
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '20');
        iconSvg.setAttribute('height', '20');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.style.cssText = 'color: #ff4444; flex-shrink: 0; margin-top: 2px;';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-width', '2');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M15 9l-6 6m0-6l6 6');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');

        iconSvg.appendChild(circle);
        iconSvg.appendChild(path);

        // Create message span safely (textContent prevents XSS)
        const messageSpan = createSafeElement('span', message);
        messageSpan.style.cssText = 'white-space: pre-line; flex: 1;';

        errorDiv.appendChild(iconSvg);
        errorDiv.appendChild(messageSpan);

        document.body.appendChild(errorDiv);
        activeMessages.add('error');

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
        try {
            alert('Error: ' + message);
        } catch (alertError) {
            console.error('Even alert failed:', alertError);
        }
    }
}

/**
 * Show warning message with XSS prevention
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

        const existing = document.getElementById('validation-warning-message');
        if (existing) {
            try {
                existing.remove();
                activeMessages.delete('warning');
            } catch (e) {
                console.warn('Failed to remove existing warning:', e);
            }
        }

        const warningDiv = createSafeElement('div', '', {
            id: 'validation-warning-message',
            class: 'validation-message validation-warning',
            role: 'alert',
            'aria-live': 'polite'
        });

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

        // Create icon SVG safely
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '20');
        iconSvg.setAttribute('height', '20');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.style.cssText = 'color: #000000; flex-shrink: 0; margin-top: 2px;';

        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z');
        path1.setAttribute('stroke', 'currentColor');
        path1.setAttribute('stroke-width', '2');

        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'M12 9v4m0 4h.01');
        path2.setAttribute('stroke', 'currentColor');
        path2.setAttribute('stroke-width', '2');
        path2.setAttribute('stroke-linecap', 'round');

        iconSvg.appendChild(path1);
        iconSvg.appendChild(path2);

        const messageSpan = createSafeElement('span', message);
        messageSpan.style.cssText = 'white-space: pre-line; flex: 1;';

        warningDiv.appendChild(iconSvg);
        warningDiv.appendChild(messageSpan);

        document.body.appendChild(warningDiv);
        activeMessages.add('warning');

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
 * Show success message with XSS prevention
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

        const successDiv = createSafeElement('div', '', {
            class: 'validation-message validation-success',
            role: 'status',
            'aria-live': 'polite'
        });

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

        // Create icon SVG safely
        const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconSvg.setAttribute('width', '20');
        iconSvg.setAttribute('height', '20');
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('fill', 'none');
        iconSvg.style.cssText = 'color: #000000; flex-shrink: 0;';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-width', '2');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M9 12l2 2 4-4');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');

        iconSvg.appendChild(circle);
        iconSvg.appendChild(path);

        const messageSpan = createSafeElement('span', message);
        messageSpan.style.cssText = 'white-space: pre-line; flex: 1;';

        successDiv.appendChild(iconSvg);
        successDiv.appendChild(messageSpan);

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
            'URL API': typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
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
// Note: formatFileSize() lives in shared-utils.js (loaded before this file).

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

try {
    console.log('✅ File Size Validation Module Loaded (Security Enhanced)');
    console.log('   Max Single File:', formatFileSize(FILE_SIZE_CONFIG.MAX_SINGLE_FILE));
    console.log('   Max Total (Merge):', formatFileSize(FILE_SIZE_CONFIG.MAX_TOTAL_MERGE));
    console.log('   Warning Size:', formatFileSize(FILE_SIZE_CONFIG.WARNING_SIZE));
    console.log('   🔒 XSS Protection: Enhanced');
    console.log('   🔒 File Type Whitelist: PDF only');
    console.log('   🔒 Filename Sanitization: Enabled');

    const compat = checkBrowserCompatibility();
    if (!compat.supported) {
        console.error('❌ Browser compatibility issues detected:', compat.missingFeatures);
    }
} catch (error) {
    console.error('Error during validation module initialization:', error);
}
