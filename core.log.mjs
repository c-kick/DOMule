/**
 * @fileoverview Fancy Console Logger - Color-coded module logging system
 * @module core.log
 * @version 3.1.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides structured, color-coded console logging for module events with intelligent
 * badge styling. Only outputs when ?debug=true is present in URL query parameters.
 * Automatically generates consistent colors per module name for easy visual tracking
 * in browser console.
 *
 * Features:
 * - Debug flag detection (?debug=true in URL)
 * - Per-module color consistency using deterministic color generation
 * - Two-badge system for core/util modules (namespace + specific module)
 * - Single-badge system for regular modules
 * - Structured message formatting with CSS styling
 * - Log level support (log, info, warn, error)
 * - Object/array pretty-printing via console native inspector
 * - Memoized badge styles for performance
 *
 * Badge System:
 * - Core/util modules: Two badges with subdued namespace + vibrant module name
 *   Example: [core][scanner] for core.scanner module
 * - Regular modules: Single vibrant badge
 *   Example: [myModule] for custom modules
 *
 * Color Generation:
 * - Uses ColorTool to generate deterministic colors from module names
 * - Same module name always produces same color (even across page reloads)
 * - Core/util namespaces share consistent subdued styling
 * - Module-specific badges get unique vibrant colors
 *
 * @example
 * // Enable debug mode via URL
 * // https://yoursite.com/page.html?debug=true
 *
 * import {logger} from './core.log.mjs';
 *
 * // Basic logging (single badge)
 * logger.log('myModule', 'Started');
 * // Console output: [myModule] Started (with colored badge)
 *
 * @example
 * // Core module logging (two badges)
 * logger.info('core.scanner', 'Scan complete');
 * // Console output: [core][scanner] Scan complete (namespace + module badges)
 *
 * @example
 * // Object logging
 * logger.info('myModule', {count: 5, status: 'ready'});
 * // Console output: [myModule] {count: 5, status: 'ready'} (with object inspector)
 *
 * @example
 * // Warning messages
 * logger.warn('myModule', 'Deprecated feature used');
 * // Console output: [myModule] Deprecated feature used (orange text)
 *
 * @example
 * // Error logging
 * logger.error('myModule', 'Failed to initialize');
 * // Console output: [myModule] Failed to initialize (red text)
 */

import ColorTool from "./util.color.mjs";

export const NAME = 'core.log';

/**
 * Read a URL parameter from either the document query string or a hash-route query string.
 * Supports SPAs where routes look like #/view?debug=true.
 * @param {string} name - Query parameter name
 * @param {string} [value] - Optional required value
 * @returns {boolean} True if the parameter exists, or matches the required value
 */
export function hasUrlParam(name, value) {
    if (typeof window === 'undefined') return false;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    try {
        const searchParams = new URLSearchParams(search);
        if (value === undefined ? searchParams.has(name) : searchParams.get(name) === value) return true;

        const hashQuery = hash.split('?')[1] || '';
        const hashParams = new URLSearchParams(hashQuery);
        return value === undefined ? hashParams.has(name) : hashParams.get(name) === value;
    } catch {
        const needle = value === undefined ? `${name}=` : `${name}=${value}`;
        return search.includes(needle) || hash.includes(needle);
    }
}

/**
 * Parse debug flag from URL using URLSearchParams for accurate detection.
 * Avoids false positives from substring matches (e.g., ?other=debug=true).
 * @private
 * @returns {boolean} True if debug=true is explicitly set
 */
function parseDebugFlag() {
    return hasUrlParam('debug', 'true');
}

/**
 * Debug mode enabled flag.
 * Only logs when ?debug=true is present in URL query parameters.
 * Set once on module load to avoid repeated parsing.
 * @type {boolean}
 */
export const DEBUG = parseDebugFlag();

/**
 * @private Internal alias for backwards compatibility
 */
const ENABLED = DEBUG;

/**
 * Base font family for all log output.
 * Provides consistent typography across all log messages.
 * @type {string}
 * @private
 */
const BASE_FONT = 'font-family: Lucida Grande,Lucida Sans Unicode,Lucida Sans,Geneva,Verdana,sans-serif';

/**
 * Memoized badge styles per module name.
 * Cache key format: "moduleName:isNamespace" (e.g., "core:true", "core.scanner:false")
 * Prevents regenerating CSS on every log call for significant performance gain.
 * @type {Map<string, string>}
 * @private
 */
const styleCache = new Map();

/**
 * Message text colors per log level.
 * Applied to message content (not badges) to indicate severity.
 * @type {Object<string, string>}
 * @private
 */
const LEVEL_COLORS = {
    log: 'black',
    info: '#1e529e',    // Blue - informational
    warn: '#fd7e14',    // Orange - warnings
    error: 'red'        // Red - errors
};

/**
 * Generate and cache badge style for a module name.
 * Uses ColorTool to create deterministic colors from module names.
 * Namespace badges (core/util) get subdued styling with desaturated colors.
 * Module badges get vibrant styling with full saturation and contrast.
 *
 * @private
 * @param {string} moduleName - Module name or namespace ('core', 'util', 'core.scanner', etc.)
 * @param {boolean} [isNamespace=false] - True if this is a namespace badge (subdued styling)
 * @returns {string} CSS style string for badge including color, background, gradient, padding
 *
 * @example
 * // Namespace badge (subdued)
 * getBadgeStyle('core', true)
 * // Returns: "...background-color:rgb(desaturated);color:rgb(darkened);..."
 *
 * @example
 * // Module badge (vibrant)
 * getBadgeStyle('core.scanner', false)
 * // Returns: "...background-color:rgb(vibrant);color:#fff;..."
 */
function getBadgeStyle(moduleName, isNamespace = false) {
    const cacheKey = `${moduleName}:${isNamespace}`;

    if (styleCache.has(cacheKey)) {
        return styleCache.get(cacheKey);
    }

    const color = ColorTool.new(moduleName);
    const baseStyle = `${BASE_FONT};padding:3px 5px;border-radius:6px;`;

    const badgeStyle = isNamespace
        // Namespace badge
        ? baseStyle +
        `color: #339;` +
        `border: 1px solid #339B;` +
        `background-color: #FFF8;` +
        `margin-right:2px;`
        // Module badge: vibrant colors, wide margin
        : baseStyle +
        `color:${color.contra};` +
        `border: 1px solid transparent;` +
        `background-color:${color.string};` +
        `margin-right:10px;` +
        `background-image:linear-gradient(0deg,${color.adjust({deg: 10}).string} 0%,${color.adjust({opa: 1}).string} 100%);`;

    styleCache.set(cacheKey, badgeStyle);
    return badgeStyle;
}

/**
 * Single log dispatcher for all levels.
 * Routes to appropriate console method (log/info/warn/error) with styled badges.
 * Automatically detects core/util modules and applies two-badge system.
 * Regular modules get single-badge treatment.
 *
 * @private
 * @param {string} level - Console method name ('log', 'info', 'warn', 'error')
 * @param {string} moduleName - Module identifier (e.g., 'core.scanner', 'myModule')
 * @param {*} message - Message content (string, object, array, etc.)
 *
 * @example
 * // Two-badge output for core module
 * logMessage('info', 'core.scanner', 'Complete');
 * // Console: [core][scanner] Complete
 *
 * @example
 * // Single-badge output for regular module
 * logMessage('log', 'myModule', 'Started');
 * // Console: [myModule] Started
 *
 * @example
 * // Object output
 * logMessage('info', 'myModule', {count: 5});
 * // Console: [myModule] {count: 5} (with inspector)
 */
function logMessage(level, moduleName, message) {
    if (!ENABLED) return;

    const consoleMethod = console[level] || console.log;
    const messageStyle = `${BASE_FONT};color:${LEVEL_COLORS[level]};`;

    // Check if this is a system module (core.* or util.*)
    const systemModuleMatch = moduleName.match(/^(core|util)\.(.+)/);

    if (systemModuleMatch) {
        // Two-badge system: namespace + specific module
        const namespace = systemModuleMatch[1];  // 'core' or 'util'
        const submodule = systemModuleMatch[2];  // 'scanner', 'loader', etc.

        const namespaceStyle = getBadgeStyle(namespace, true);   // subdued
        const moduleStyle = getBadgeStyle(moduleName, false);     // vibrant

        if (typeof message === 'object' && message !== null) {
            // Object: show badges + native inspector
            consoleMethod(`%c${namespace}%c${submodule}`, namespaceStyle, moduleStyle, message);
        } else {
            // Primitive: show badges + styled text
            consoleMethod(`%c${namespace}%c${submodule}%c ${message}`, namespaceStyle, moduleStyle, messageStyle);
        }
    } else {
        // Single badge for non-system modules
        const moduleStyle = getBadgeStyle(moduleName, false);

        if (typeof message === 'object' && message !== null) {
            // Object: show badge + native inspector
            consoleMethod(`%c${moduleName}`, moduleStyle, message);
        } else {
            // Primitive: show badge + styled text
            consoleMethod(`%c${moduleName}%c ${message}`, moduleStyle, messageStyle);
        }
    }
}

/**
 * Public logging API.
 * Only outputs when ?debug=true is present in URL.
 * Provides four log levels with automatic badge styling and color coding.
 *
 * @namespace
 * @type {Object}
 *
 * @example
 * // Enable debug mode
 * // https://yoursite.com/page.html?debug=true
 *
 * import {logger} from './core.log.mjs';
 *
 * // Different log levels
 * logger.log('myModule', 'Normal message');
 * logger.info('myModule', 'Info message');     // Blue text
 * logger.warn('myModule', 'Warning message');  // Orange text
 * logger.error('myModule', 'Error message');   // Red text
 *
 * @example
 * // Core module logging (two badges)
 * logger.info('core.scanner', 'Scanning...');
 * // Output: [core][scanner] Scanning...
 *
 * @example
 * // Object logging
 * logger.log('myModule', {config: true, count: 5});
 * // Output: [myModule] {config: true, count: 5} (with object inspector)
 */
export const logger = {
    /**
     * Log informational message (black text).
     * Use for general operation messages and status updates.
     *
     * @param {string} moduleName - Module name (generates consistent color badge)
     * @param {*} message - Message string or object to log
     *
     * @example
     * logger.log('myModule', 'Operation completed');
     * logger.log('myModule', {result: true, time: 150});
     */
    log(moduleName, message) {
        logMessage('log', moduleName, message);
    },

    /**
     * Log info-level message (blue text).
     * Use for informational messages that highlight progress or state changes.
     *
     * @param {string} moduleName - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.info('myModule', 'Configuration loaded');
     * logger.info('core.scanner', 'Scan complete: 4 modules found');
     */
    info(moduleName, message) {
        logMessage('info', moduleName, message);
    },

    /**
     * Log warning message (orange text).
     * Use for deprecation notices, non-fatal issues, or concerning states.
     *
     * @param {string} moduleName - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.warn('myModule', 'Feature deprecated, use X instead');
     * logger.warn('core.loader', 'Module has no init() function');
     */
    warn(moduleName, message) {
        logMessage('warn', moduleName, message);
    },

    /**
     * Log error message (red text).
     * Use for fatal errors, initialization failures, or exceptions.
     *
     * @param {string} moduleName - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.error('myModule', 'Failed to initialize');
     * logger.error('core.loader', 'Module import failed: ' + error.message);
     * logger.error('myModule', new Error('Network timeout'));
     */
    error(moduleName, message) {
        logMessage('error', moduleName, message);
    }
};

/**
 * Legacy alias for logger (v2.x compatibility).
 * Use `logger` instead in new code.
 * @deprecated Use `logger` instead
 * @type {Object}
 */
export const hnlLogger = logger;
