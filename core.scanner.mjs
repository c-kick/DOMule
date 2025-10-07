import {logger} from "./core.log.mjs";
export const NAME = 'domScanner';
/**
 * Scans DOM for elements with data-requires attribute.
 * Groups elements by module path, splitting on comma-separated lists.
 * Defers modules if data-require-lazy="true" is present.
 *
 * @param {function} callback - Called with (modules, deferred, stats)
 *   - modules: Object mapping module paths to arrays of elements (immediate load)
 *   - deferred: Object mapping module paths to arrays of elements (lazy load)
 *   - stats: Object with {immediate, lazy, total} counts
 * @returns {object} - Scan results {modules, deferred, stats}
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