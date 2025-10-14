/**
 * @fileoverview DOM Utilities - Pure helper functions for DOM manipulation
 * @module util.dom
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides lightweight DOM manipulation utilities with no side effects.
 * Pure functions for element creation, script path resolution, and CSS loading.
 */

import {logger} from './core.log.mjs';

export const NAME = 'dom';

// ============================================================================
// CONSTANTS
// ============================================================================

/** @private Default timeout for node waiting (30 seconds) */
const DEFAULT_WAIT_TIMEOUT = 30000;

/** @private Default polling interval for node waiting (100ms) */
const DEFAULT_WAIT_INTERVAL = 100;

/** @private Regex for extracting URLs from error stack traces (legacy fallback) */
const URL_EXTRACTION_REGEX = /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»""'']))/ig;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Waits for a complex DOM node to appear, supporting shadow DOM traversal.
 *
 * Continuously polls using provided getter function until node is found or timeout.
 * Useful for elements rendered asynchronously or within shadow roots.
 *
 * Returns cleanup function to cancel waiting (prevents memory leaks in SPAs).
 *
 * @param {Function} getNode - Function returning target node or null
 *   Example: () => document.querySelector('host')?.shadowRoot.querySelector('child')
 * @param {Function} callback - Called with found node as argument
 * @param {number} [timeout=30000] - Maximum wait time in milliseconds
 * @param {number} [interval=100] - Polling interval in milliseconds
 * @returns {Function} Cleanup function to cancel waiting
 * @throws {TypeError} If getNode or callback are not functions
 *
 * @example
 * // Simple element
 * const cleanup = waitForComplexNode(
 *   () => document.querySelector('.my-element'),
 *   node => console.log('Found:', node)
 * );
 *
 * @example
 * // Shadow DOM element
 * waitForComplexNode(
 *   () => document.querySelector('my-component')
 *     ?.shadowRoot
 *     ?.querySelector('.inner-element'),
 *   node => initFeature(node)
 * );
 *
 * @example
 * // With cleanup in SPA
 * const cleanup = waitForComplexNode(getNode, callback);
 * // Later, on route change:
 * cleanup();
 */
export function waitForComplexNode(getNode, callback, timeout = DEFAULT_WAIT_TIMEOUT, interval = DEFAULT_WAIT_INTERVAL) {
    if (typeof getNode !== 'function') {
        throw new TypeError('getNode must be a function');
    }
    if (typeof callback !== 'function') {
        throw new TypeError('callback must be a function');
    }

    const startTime = Date.now();
    let timerId = null;
    let cancelled = false;

    (function checkNode() {
        if (cancelled) return;

        let node = null;
        try {
            node = getNode();
        } catch (error) {
            // Shadow DOM not ready yet, treat as not found
            node = null;
        }

        if (node) {
            callback(node);
            return;
        }

        if (Date.now() - startTime < timeout) {
            timerId = setTimeout(checkNode, interval);
        } else {
            logger.warn(NAME, `Node not found within ${timeout / 1000} seconds`);
        }
    })();

    // Return cleanup function
    return () => {
        cancelled = true;
        if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
        }
    };
}

/**
 * Converts HTML string to DOM Node or NodeList.
 *
 * Uses <template> element for efficient parsing without triggering resource loads
 * or script execution. Template content is garbage collected after return.
 *
 * @param {string} string - HTML string to parse
 * @returns {Element|HTMLCollection} Single element or collection of elements
 * @throws {TypeError} If string is not a string type
 *
 * @example
 * // Single element
 * const div = parseHTML('<div class="box">Content</div>');
 * document.body.appendChild(div);
 *
 * @example
 * // Multiple elements
 * const nodes = parseHTML('<div>First</div><span>Second</span>');
 * nodes.forEach(node => document.body.appendChild(node));
 *
 * @example
 * // Complex structure
 * const card = parseHTML(`
 *   <article class="card">
 *     <h2>Title</h2>
 *     <p>Description</p>
 *   </article>
 * `);
 */
export function parseHTML(string) {
    if (typeof string !== 'string') {
        throw new TypeError('Input must be a string');
    }

    // <template> uses documentFragment internally - memory efficient,
    // doesn't trigger resource loads or script execution
    const template = document.createElement('template');
    template.innerHTML = string.trim();
    const content = template.content;

    return content.childElementCount === 1
        ? content.firstElementChild
        : content.children;
}

/** @deprecated Use parseHTML() instead. Removed in v4.0 */
export function stringToObj(string) {
    if (DEBUG) logger.warn(NAME, 'stringToObj() deprecated, use parseHTML()');
    return parseHTML(string);
}

/**
 * Resolves path of current script file.
 *
 * Modern browsers: Uses import.meta.url (ES6 modules)
 * Legacy browsers: Extracts from error stack trace
 *
 * Browser support:
 * - Modern: Chrome 64+, Safari 11.1+, Firefox 62+ (ES6 module baseline)
 * - Legacy: Chrome 10+, Safari 6+, Firefox 4+ (Error.stack support)
 *
 * @returns {string} Path to current script directory (no trailing slash)
 *
 * @example
 * // In module at /assets/js/modules/mymodule.mjs
 * const path = getScriptPath();
 * // Returns: '/assets/js/modules'
 *
 * @example
 * // Load sibling resource
 * const modulePath = getScriptPath();
 * const cssPath = `${modulePath}/styles.css`;
 */
export function getScriptPath() {
    // Modern: ES6 module with import.meta
    const hasImportMeta = typeof import.meta !== 'undefined'
        && typeof import.meta.url === 'string';

    if (hasImportMeta) {
        return new URL(import.meta.url).pathname
            .split('/')
            .slice(0, -1)
            .join('/');
    }

    // Legacy: Extract from error stack trace
    try {
        const stack = new Error().stack;
        const urls = stack.match(URL_EXTRACTION_REGEX);

        if (urls && urls.length > 0) {
            const lastUrl = urls[urls.length - 1];
            return lastUrl.substring(0, lastUrl.lastIndexOf('/'));
        }
    } catch (error) {
        logger.error(NAME, 'Failed to extract script path from stack trace');
    }

    // Absolute fallback
    return '/';
}

/**
 * Dynamically loads CSS file into document head.
 *
 * Creates <link rel="stylesheet"> element and appends to <head>.
 * Does not wait for stylesheet to load - use link.onload if needed.
 *
 * @param {string} src - URL of CSS file to load
 * @returns {HTMLLinkElement} Created link element (for load tracking)
 * @throws {Error} If src parameter is empty or missing
 *
 * @example
 * // Basic usage
 * writeCSS('/assets/css/module.css');
 *
 * @example
 * // Track load completion
 * const link = writeCSS('/assets/css/module.css');
 * link.onload = () => console.log('CSS loaded');
 * link.onerror = () => console.error('CSS failed to load');
 *
 * @example
 * // Relative to script path
 * const modulePath = getScriptPath();
 * writeCSS(`${modulePath}/styles.css`);
 */
export function writeCSS(src) {
    if (!src || typeof src !== 'string') {
        throw new Error('CSS file path must be a non-empty string');
    }

    const link = document.createElement('link');
    link.setAttribute('type', 'text/css');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', src);

    document.head.appendChild(link);

    return link;
}