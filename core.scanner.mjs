/**
 * @fileoverview DOM Scanner - Discovers and groups elements requiring dynamic modules
 * @module core.scanner
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 */

import {logger} from "./core.log.mjs";

export const NAME = 'core.scanner';

/**
 * Scans DOM for elements with data-requires attribute and groups them by module path.
 *
 * Elements are categorized as immediate (load now) or deferred (lazy load) based on
 * the data-require-lazy="true" attribute. Comma-separated module paths are split
 * and each path gets its own array of requesting elements.
 *
 * @param {Function} [callback] - Called with (modules, deferred, stats) when scan completes
 *   - modules: Object mapping module paths to element arrays (immediate load)
 *   - deferred: Object mapping module paths to element arrays (lazy load)
 *   - stats: Object with {immediate, lazy, total} counts
 * @returns {{modules: Object<string, HTMLElement[]>, deferred: Object<string, HTMLElement[]>, stats: {immediate: number, lazy: number, total: number}}}
 *   Scan results object containing categorized modules and statistics
 *
 * @example
 * // Scan and process results
 * const {modules, deferred, stats} = domScanner((mods, def, stats) => {
 *   console.log(`Found ${stats.immediate} immediate, ${stats.lazy} lazy modules`);
 * });
 *
 * @example
 * // Element with comma-separated modules
 * <div data-requires="./slider.mjs,./analytics.mjs"></div>
 * // Results in:
 * modules['./slider.mjs'] = [div]
 * modules['./analytics.mjs'] = [div]
 *
 * @example
 * // Lazy loading element
 * <div data-requires="./gallery.mjs" data-require-lazy="true"></div>
 * // Results in:
 * deferred['./gallery.mjs'] = [div]
 */
export function domScanner(callback) {
    logger.info(NAME, 'Scanning DOM for data-requires modules...');

    const modules = {};
    const deferred = {};

    const elements = document.querySelectorAll('[data-requires]');
    const elementCount = elements.length;

    // Early exit - avoid forEach overhead
    if (elementCount === 0) {
        logger.info(NAME, 'Scan complete: 0 modules found.');
        if (typeof callback === 'function') {
            callback.call(null, modules, deferred, {immediate: 0, lazy: 0, total: 0});
        }
        return {modules, deferred, stats: {immediate: 0, lazy: 0, total: 0}};
    }

    // Initialize state tracking for each element
    for (let i = 0; i < elementCount; i++) {
        const element = elements[i];
        const requiresAttr = element.dataset.requires;

        if (requiresAttr && requiresAttr.trim()) {
            const modulePaths = requiresAttr.split(',').filter(p => p.trim());

            element._moduleTracking = {
                required: modulePaths.length,
                loaded: 0
            };
            element.classList.add('module-pending');
            element.dataset.requiresState = 'pending';
        }
    }

    // Process elements - use traditional for loop for better performance in older browsers
    for (let i = 0; i < elementCount; i++) {
        const element = elements[i];
        const requiresAttr = element.dataset.requires;

        // Skip empty/whitespace-only
        if (!requiresAttr || !requiresAttr.trim()) continue;

        const isLazy = element.dataset.requireLazy === 'true';
        const targetBucket = isLazy ? deferred : modules;

        // Split and process module paths
        const modulePaths = requiresAttr.split(',');
        const pathCount = modulePaths.length;

        for (let j = 0; j < pathCount; j++) {
            const modulePath = modulePaths[j].trim();
            if (!modulePath) continue;

            // Lazily initialize array
            if (!targetBucket[modulePath]) {
                targetBucket[modulePath] = [];
            }

            targetBucket[modulePath].push(element);
        }
    }

    // Calculate stats once
    const immediateKeys = Object.keys(modules);
    const deferredKeys = Object.keys(deferred);
    const stats = {
        immediate: immediateKeys.length,
        lazy: deferredKeys.length,
        total: immediateKeys.length + deferredKeys.length
    };

    // Log results
    if (stats.total === 0) {
        logger.info(NAME, 'Scan complete: 0 modules found.');
    } else {
        logger.info(
            NAME,
            'Scan complete: ' + stats.immediate + ' module(s) found' +
            (stats.lazy ? ', ' + stats.lazy + ' lazy module(s)' : '') + '.'
        );
    }

    // Invoke callback
    if (typeof callback === 'function') {
        callback.call(null, modules, deferred, stats);
    }

    return {modules, deferred, stats};
}