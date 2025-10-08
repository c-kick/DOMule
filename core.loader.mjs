/**
 * @fileoverview Dynamic Module Loader - Orchestrates module imports and initialization
 * @module core.loader
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Handles dynamic import of ES6 modules based on DOM element requirements.
 * Supports immediate loading, lazy loading (on element visibility), path rewriting,
 * and automatic module initialization via init() functions.
 *
 * Features:
 * - Parallel module loading with Promise.allSettled
 * - IntersectionObserver-based lazy loading (with scroll fallback)
 * - Path rewriting (%path% aliases, relative path adjustment)
 * - CSP/nonce support via global SITE_NONCE
 * - Debug mode with cache-busting
 * - Cleanup API for SPA unmounting
 */

import {domScanner} from "./core.scanner.mjs";
import {isVisible} from "./util.observe.mjs";
import {logger} from "./core.log.mjs";
import eventHandler from "./core.events.mjs";
import {ModuleRegistry} from './core.registry.mjs';

export const NAME = 'core.loader';

// ============================================================================
// MODULE STATE
// ============================================================================

/** @type {Object<string, HTMLElement[]>} Deferred modules awaiting visibility */
const deferredModules = {};

/** @type {Object<string, string>} Default path mappings */
const defaultPaths = {};

/** @type {Map<string, string>} Memoized rewritten paths */
const pathCache = new Map();

/** @type {Map<string, IntersectionObserver>} Active lazy load observers */
const lazyObservers = new Map();

/** @type {Map<string, Function>} Active lazy load scroll watchers */
const lazyListeners = new Map();

/** @type {boolean} Debug flag cached for performance */
const DEBUG = typeof window !== 'undefined' && window.location.search.includes('debug=true');

/** @type {WeakMap<HTMLElement, Object>} Per-element module state storage */
const elementModuleStates = new WeakMap();

// ============================================================================
// PRIVATE UTILITIES
// ============================================================================

/**
 * Updates module load state for elements.
 * Increments counter and transitions to 'loaded' when all modules complete.
 * @private
 * @param {HTMLElement[]} elements - Elements requiring the module
 * @param {boolean} [isError=false] - Whether this is an error state
 */
function updateModuleState(elements, isError = false) {
    elements.forEach(el => {
        if (!el._moduleTracking) return;

        if (isError) {
            // Error state is terminal - don't increment counter
            el.classList.remove('module-pending', 'module-loading');
            el.classList.add('module-error');
            el.dataset.requiresState = 'error';
        } else {
            // Success - increment and check if complete
            el._moduleTracking.loaded++;

            if (el._moduleTracking.loaded === el._moduleTracking.required) {
                el.classList.remove('module-pending', 'module-loading');
                el.classList.add('module-loaded');
                el.dataset.requiresState = 'loaded';
            }
        }
    });
}

// ============================================================================
// POLYFILLS
// ============================================================================

/**
 * Polyfill Promise.allSettled for Safari 10.1-12, Firefox 60-70, Edge 16-79
 * @private
 */
if (!Promise.allSettled) {
    Promise.allSettled = function(promises) {
        return Promise.all(
            promises.map(function(p) {
                return Promise.resolve(p)
                    .then(function(value) { return { status: 'fulfilled', value: value }; })
                    .catch(function(reason) { return { status: 'rejected', reason: reason }; });
            })
        );
    };
}

// ============================================================================
// PRIVATE UTILITIES
// ============================================================================

/**
 * Generates random string for cache-busting in debug mode.
 * Uses crypto.randomUUID() (Chrome 92+, Safari 15.4+) or crypto.getRandomValues() fallback.
 * @private
 * @returns {string} Random UUID or hex string
 */
function getRandomString() {
    if (typeof window !== 'undefined' && window.crypto) {
        if (window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        return Array.from(
            window.crypto.getRandomValues(new Uint8Array(16)),
            function(b) { return b.toString(16).padStart(2, '0'); }
        ).join('');
    }
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

/**
 * Rewrites module path with memoization for performance.
 *
 * Handles:
 * - %path% alias resolution (e.g., %assets% → https://cdn.example.com/)
 * - Relative path adjustment (./ → ./../ for correct resolution)
 * - SITE_NONCE injection for CSP compliance
 * - Debug mode cache-busting with random parameter
 *
 * @private
 * @param {string} uri - Original module URI
 * @param {Object<string, string>} dynamicPaths - Path alias mappings
 * @returns {string} Rewritten URI with query parameters
 *
 * @example
 * // With alias
 * rewritePath('%assets%module.mjs', {assets: 'https://cdn.com/'})
 * // → 'https://cdn.com/module.mjs'
 *
 * @example
 * // Relative path
 * rewritePath('./modules/slider.mjs', {})
 * // → './../modules/slider.mjs'
 *
 * @example
 * // Debug mode
 * rewritePath('./module.mjs', {})
 * // → './../module.mjs?debug=true&random=abc123'
 */
function rewritePath(uri, dynamicPaths) {
    const cacheKey = uri + JSON.stringify(dynamicPaths);

    if (pathCache.has(cacheKey)) {
        return pathCache.get(cacheKey);
    }

    const params = new URLSearchParams(uri.split('?')[1] || '');

    const customPath = (new RegExp(/^%(.*?)%/gi).exec(uri));
    if (customPath && dynamicPaths[customPath[1]]) {
        uri = uri.replace(customPath[0] + '/', dynamicPaths[customPath[1]]);
    } else {
        if (typeof SITE_NONCE !== 'undefined') {
            params.append('nonce', SITE_NONCE);
        }
        uri = uri.replace('./', './../');
    }

    if (DEBUG) {
        params.append('debug', 'true');
        params.append('random', getRandomString());
    }

    const base = uri.split('?')[0];
    const query = params.toString();
    const result = query ? `${base}?${query}` : base;

    pathCache.set(cacheKey, result);
    return result;
}

/**
 * Extracts module name from exported NAME constant or filename.
 * @private
 * @param {Object} module - Imported module object
 * @param {string} path - Module file path
 * @returns {string} Module name for logging
 */
function moduleName(module, path) {
    if (typeof module.NAME !== 'undefined') return module.NAME;
    return path.split('/').pop().split('?')[0];
}

// ============================================================================
// LAZY LOADING - PRIVATE
// ============================================================================

/**
 * Common import and initialization logic for lazy-loaded modules.
 * Prevents duplicate loads and handles init() execution.
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - All elements requiring this module
 * @param {HTMLElement} triggeringElement - Element that became visible
 * @param {Object<string, string>} dynImportPaths - Path mappings
 * @param {Function} cleanupCallback - Cleanup function (observer or listener)
 */
function importLazyModule(key, elements, triggeringElement, dynImportPaths, cleanupCallback) {
    if (!deferredModules[key] || deferredModules[key]._loading) return;

    deferredModules[key]._loading = true;

    const elementId = triggeringElement.id || triggeringElement.className || triggeringElement.tagName;
    const path = rewritePath(key, dynImportPaths);
    logger.info(NAME, `Element '${elementId}' visible, lazy-loading module: ${moduleName({}, key)}`);

    // Add loading state
    triggeringElement.classList.remove('module-pending');
    triggeringElement.classList.add('module-loading');
    triggeringElement.dataset.requiresState = 'loading';

    import(path)
        .then(function(module) {
            const name = moduleName(module, key);
            logger.info(name, ' Imported (lazy).');

            // Update state for all elements requiring this module
            updateModuleState(elements);

            if (typeof module.init === 'function') {
                logger.info(name, ` Initializing (lazy) for ${elements.length} element(s).`);

                // Attach triggering element info for modules that need it
                elements.triggeringElement = triggeringElement;

                try {
                    const result = module.init.call(module, elements);
                    ModuleRegistry.register(name, module, elements, 'loaded');
                    if (result === false) {
                        logger.warn(name, 'Module initialization returned: ' + result);
                    } else if (typeof result !== 'undefined') {
                        logger.info(name, ' Initialized, module said: ' + result);
                    }
                } catch (error) {
                    ModuleRegistry.register(name, module, elements, 'error');
                    logger.error(name, 'Initialization failed: ' + error.message);
                }
            }

            // Clean up triggering element reference
            delete elements.triggeringElement;
            cleanupCallback();
        })
        .catch(function(error) {
            logger.error(NAME, error);

            // Mark error state
            updateModuleState(elements, true);

            delete elements.triggeringElement;
            cleanupCallback();
        });
}

/**
 * Routes lazy loading to IntersectionObserver (modern) or scroll watcher (fallback).
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements requiring module
 * @param {Object<string, string>} dynImportPaths - Path mappings
 */
function setupLazyLoading(key, elements, dynImportPaths) {
    if (typeof IntersectionObserver !== 'undefined') {
        setupIntersectionObserver(key, elements, dynImportPaths);
    } else {
        setupScrollWatcher(key, elements, dynImportPaths);
    }
}

/**
 * Modern lazy loading using IntersectionObserver API.
 * Supported: Chrome 61+, Safari 10.1+, Firefox 60+, Edge 16+
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements to observe
 * @param {Object<string, string>} dynImportPaths - Path mappings
 */
function setupIntersectionObserver(key, elements, dynImportPaths) {
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                importLazyModule(key, elements, entry.target, dynImportPaths, function() {
                    cleanupLazyModule(key, observer, null);
                });
                break;
            }
        }
    }, {
        rootMargin: '50px' // Start loading slightly before element enters viewport
    });

    for (const element of elements) {
        observer.observe(element);
    }

    lazyObservers.set(key, observer);
}

/**
 * Fallback lazy loading using scroll events for browsers without IntersectionObserver.
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements to watch
 * @param {Object<string, string>} dynImportPaths - Path mappings
 */
function setupScrollWatcher(key, elements, dynImportPaths) {
    const watchModules = function() {
        if (!deferredModules[key] || deferredModules[key]._loading) return;

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            isVisible(element, function(visible) {
                if (visible) {
                    importLazyModule(key, elements, element, dynImportPaths, function() {
                        cleanupLazyModule(key, null, watchModules);
                    });
                }
            });
        }
    };

    lazyListeners.set(key, watchModules);
    eventHandler.addListener('docShift', watchModules);
}

/**
 * Removes observers/listeners and clears deferred module state.
 * @private
 * @param {string} key - Module path key
 * @param {IntersectionObserver|null} observer - Observer to disconnect
 * @param {Function|null} listener - Event listener to remove
 */
function cleanupLazyModule(key, observer, listener) {
    if (observer) {
        observer.disconnect();
        lazyObservers.delete(key);
    }
    if (listener) {
        eventHandler.removeListener('docShift', listener);
        lazyListeners.delete(key);
    }
    delete deferredModules[key];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Scans DOM for data-requires attributes and dynamically imports modules.
 *
 * Immediate modules load in parallel. Lazy modules (data-require-lazy="true")
 * load when their elements become visible. All module init() functions receive
 * arrays of all elements that required them.
 *
 * @param {Object<string, string>|Function} [paths] - Path alias mappings or callback
 * @param {Function} [callback] - Called after all immediate modules finish loading
 *
 * @example
 * // Basic usage
 * dynImports(() => {
 *   console.log('All modules loaded');
 * });
 *
 * @example
 * // With path aliases
 * dynImports({
 *   'assets': 'https://cdn.example.com/js/',
 *   'vendor': 'https://unpkg.com/'
 * }, () => {
 *   console.log('Modules loaded');
 * });
 *
 * @example
 * // HTML usage
 * // <div data-requires="%assets%slider.mjs"></div>
 * // <img data-requires="./gallery.mjs" data-require-lazy="true">
 */
export function dynImports(paths, callback) {
    if (typeof paths === 'function') {
        callback = paths;
        paths = {};
    }

    const dynImportPaths = { ...defaultPaths, ...(paths || {}) };

    domScanner(function (modules, deferred, totals) {
        const importPromises = [];

        // Process immediate modules using Object.entries for better performance
        for (const [key, elements] of Object.entries(modules)) {
            const path = rewritePath(key, dynImportPaths);
            logger.info(NAME, `Importing ${path.split('?')[0]}...`);

            importPromises.push(
                import(path)
                    .then(function(module) {
                        const name = moduleName(module, key);
                        logger.info(name, ' Imported.');

                        // Update state for all elements requiring this module
                        updateModuleState(elements);

                        if (typeof module.init === 'function') {
                            logger.info(name, ` Initializing for ${elements.length} element(s).`);
                            try {
                                const result = module.init.call(module, elements);
                                ModuleRegistry.register(name, module, elements, 'loaded');
                                if (result === false) {
                                    logger.warn(name, 'Module initialization returned: ' + result);
                                } else if (typeof result !== 'undefined') {
                                    logger.info(name, ' Initialized, module said: ' + result);
                                }
                            } catch (error) {
                                ModuleRegistry.register(name, module, elements, 'error');
                                logger.error(name, 'Initialization failed: ' + error.message);
                            }
                        }
                    })
                    .catch(function(error) {
                        logger.error(NAME, error);

                        // Mark error state
                        updateModuleState(elements, true);
                    })
            );
        }

        Promise.allSettled(importPromises).then(function() {
            logger.info(NAME, 'All dynamic imports finished loading.');
            if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
                logger.info(NAME, { modules: modules, deferredModules: deferred });
            }
            if (typeof callback === 'function') {
                callback.call(this);
            }
        });

        // Setup lazy loading for deferred modules
        for (const [key, elements] of Object.entries(deferred)) {
            deferredModules[key] = elements;
            setupLazyLoading(key, elements, dynImportPaths);
        }
    });
}

/**
 * Cleanup function to remove all listeners and observers.
 * Call before unmounting in SPAs to prevent memory leaks.
 *
 * @example
 * // In SPA route change
 * import {cleanup} from './core.loader.mjs';
 * cleanup();
 */
export function cleanup() {
    // Disconnect all IntersectionObservers
    for (const observer of lazyObservers.values()) {
        observer.disconnect();
    }
    lazyObservers.clear();

    // Remove all event listeners
    for (const listener of lazyListeners.values()) {
        eventHandler.removeListener('docShift', listener);
    }
    lazyListeners.clear();

    // Clear caches
    pathCache.clear();

    logger.info(NAME, 'Cleanup complete.');
}