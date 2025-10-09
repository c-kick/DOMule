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
import {telemetry} from "./core.telemetry.mjs";

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

/** @type {boolean} Cache flag cached for performance */
const NO_CACHE = DEBUG && !window.location.search.includes('cache=true');

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
 * Rewrites module path with minification, memorization, and debug handling.
 *
 * @private
 * @param {string} uri - Original module URI
 * @param {Object<string, string>} dynamicPaths - Path alias mappings
 * @param {boolean} [forceUnminified=false] - Skip minification (fallback mode)
 * @returns {string} Rewritten URI
 *
 * @example
 * // Production mode
 * rewritePath('./module.mjs', {})
 * // → './../module.min.mjs'
 *
 * @example
 * // Debug mode
 * rewritePath('./module.mjs', {})
 * // → './../module.mjs?debug=true&random=abc123'
 *
 * @example
 * // Fallback mode
 * rewritePath('./module.mjs', {}, true)
 * // → './../module.mjs'
 */
function rewritePath(uri, dynamicPaths, forceUnminified = false) {
    const cacheKey = uri + JSON.stringify(dynamicPaths) + forceUnminified;

    if (pathCache.has(cacheKey)) {
        return pathCache.get(cacheKey);
    }

    const params = new URLSearchParams(uri.split('?')[1] || '');

    // Handle path aliases
    const customPath = (new RegExp(/^%(.*?)%/gi).exec(uri));
    if (customPath && dynamicPaths[customPath[1]]) {
        uri = uri.replace(customPath[0] + '/', dynamicPaths[customPath[1]]);
    } else {
        if (typeof SITE_NONCE !== 'undefined') {
            params.append('nonce', SITE_NONCE);
        }
        uri = uri.replace('./', './../');
    }

    // Minification logic
    const base = uri.split('?')[0];

    // Only minify .mjs files, skip if debug mode or forced unminified
    if (!DEBUG && !forceUnminified && base.endsWith('.mjs')) {
        // Transform: module.mjs → module.min.mjs
        uri = base.replace(/\.mjs$/, '.min.mjs');
    } else {
        uri = base;
    }

    // Debug parameters
    if (NO_CACHE) {
        params.append('random', getRandomString());
    }

    const query = params.toString();
    const result = query ? `${uri}?${query}` : uri;

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
        .catch((error) => {
            // Minified fallback for lazy modules
            if (path.includes('.min.mjs') && !DEBUG) {
                logger.info(NAME, `Minified version unavailable, retrying unminified: ${key}`);

                const fallbackPath = rewritePath(key, dynImportPaths, true);
                return import(fallbackPath);
            }

            throw error;
        })
        .then(function(module) {
            const name = moduleName(module, key);
            // Get metrics synchronously
            const metrics = recordModuleMetrics(name, path, elements);

            // Log with size info
            if (metrics) {
                const sizeKB = (metrics.size / 1024).toFixed(1);
                const cacheStatus = metrics.cached ? 'cached' : 'uncached';
                logger.info(name, ` Imported (lazy). (${sizeKB}KB, ${cacheStatus})`);
            } else {
                logger.info(name, ' Imported (lazy).');
            }

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
            logger.error(NAME, `Failed to lazy-load ${key}: ${error.message}`);
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

function recordModuleMetrics(name, path, elements) {
    if (!telemetry.isEnabled()) return null;

    const filename = path.split('/').pop().split('?')[0];
    const entries = performance.getEntriesByType('resource');
    const entry = entries.find(e => e.name.includes(filename));

    if (entry) {
        const metrics = {
            size: entry.transferSize || entry.encodedBodySize || 0,
            duration: entry.duration,
            cached: entry.transferSize === 0,
            compression: entry.encodedBodySize / entry.decodedBodySize,
            elements: elements.length,
            url: entry.name
        };

        telemetry.recordModuleLoad(name, metrics);
        return metrics;
    }

    return null;
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
                    .catch((error) => {
                        // If minified failed, retry unminified
                        if (path.includes('.min.mjs') && !DEBUG) {
                            logger.info(NAME, `Minified version unavailable, retrying unminified: ${key}`);

                            const fallbackPath = rewritePath(key, dynImportPaths, true);
                            return import(fallbackPath);
                        }

                        // Re-throw if not a minification issue
                        throw error;
                    })
                    .then(function(module) {
                        const name = moduleName(module, key);
                        // Get metrics synchronously
                        const metrics = recordModuleMetrics(name, path, elements);

                        if (metrics) {
                            const sizeKB = (metrics.size / 1024).toFixed(1);
                            const cacheStatus = metrics.cached ? 'cached' : 'uncached';
                            logger.info(name, ` Imported. (${sizeKB}KB, ${cacheStatus})`);
                        } else {
                            logger.info(name, ' Imported.');
                        }

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
                        logger.error(NAME, `Failed to load ${key}: ${error.message}`);
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