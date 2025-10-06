/**
 * Dynamic module importer v1.4.0 (Optimized - 2025)
 * (C) hnldesign 2022-2025
 *
 * -  Scans DOM for elements that have a 'data-requires' attribute set
 * -  Loads all modules found in parallel
 * -  Supports lazy loading via 'data-requires-lazy="true"'
 * -  Uses IntersectionObserver for efficient visibility detection
 * -  Path rewriting memoization for better performance
 *
 * Example:
 * <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>
 */
import {domScanner} from "./hnl.domscanner.mjs";
import {isVisible} from "./hnl.helpers.mjs";
import {hnlLogger} from "./hnl.logger.mjs";
import eventHandler from "./hnl.eventhandler.mjs";

export const NAME = 'dynImports';

const deferredModules = {};
const defaultPaths = {};
const pathCache = new Map();
const lazyObservers = new Map();
const lazyListeners = new Map();
// Cache debug flag for rewritePath() performance (checked multiple times per module)
const DEBUG = typeof window !== 'undefined' && window.location.search.includes('debug=true');

// Polyfill Promise.allSettled for Safari 10.1-12, Firefox 60-70, Edge 16-79
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

/**
 * Generates a random string for cache-busting.
 * Uses crypto.randomUUID() if available (Chrome 92+, Safari 15.4+),
 * falls back to crypto.getRandomValues() for older browsers.
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
 * Rewrites the path of the module with memoization for performance.
 * Includes site nonce if it exists. Replaces %path% definitions.
 * @param {string} uri - The URI of the module to load.
 * @param {object} dynamicPaths - Path mappings
 * @returns {string} - The rewritten URI
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
 * Gets the module name from either the exported NAME const, or the module's path (filename).
 * @param {object} module - The imported module
 * @param {string} path - The path of the module
 * @returns {string} The name of the module
 */
function moduleName(module, path) {
    if (typeof module.NAME !== 'undefined') return module.NAME;
    return path.split('/').pop().split('?')[0];
}

/**
 * Common module import and initialization logic for lazy loading
 * @param {string} key - Module key
 * @param {Array} elements - All elements requiring the module
 * @param {Element} triggeringElement - The specific element that triggered the load
 * @param {object} dynImportPaths - Path mappings
 * @param {function} cleanupCallback - Function to call for cleanup (observer or listener)
 */
function importLazyModule(key, elements, triggeringElement, dynImportPaths, cleanupCallback) {
    if (!deferredModules[key] || deferredModules[key]._loading) return;

    deferredModules[key]._loading = true;

  const elementId = triggeringElement.id || triggeringElement.className || triggeringElement.tagName;
    const path = rewritePath(key, dynImportPaths);
  hnlLogger.info(NAME, `Element '${elementId}' visible, lazy-loading module: ${moduleName({}, key)}`);

    import(path)
        .then(function(module) {
            const name = moduleName(module, key);
            hnlLogger.info(name, ' Imported (lazy).');

            if (typeof module.init === 'function') {
                hnlLogger.info(name, ` Initializing (lazy) for ${elements.length} element(s).`);

        // Attach triggering element info for modules that need it
        elements.triggeringElement = triggeringElement;

                try {
                    const result = module.init.call(module, elements);
                    if (result === false) {
                        hnlLogger.warn(name, 'Module initialization returned: ' + result);
                    } else if (typeof result !== 'undefined') {
                        hnlLogger.info(name, ' Initialized, module said: ' + result);
                    }
                } catch (error) {
                    hnlLogger.error(name, 'Initialization failed: ' + error.message);
                }
            }

      // Clean up triggering element reference
      delete elements.triggeringElement;
            cleanupCallback();
        })
        .catch(function(error) {
            hnlLogger.error(NAME, error);
      delete elements.triggeringElement;
            cleanupCallback();
        });
}

/**
 * Sets up lazy loading using IntersectionObserver for optimal performance.
 * @param {string} key - Module key
 * @param {Array} elements - Elements requiring the module
 * @param {object} dynImportPaths - Path mappings
 */
function setupLazyLoading(key, elements, dynImportPaths) {
    if (typeof IntersectionObserver !== 'undefined') {
        setupIntersectionObserver(key, elements, dynImportPaths);
    } else {
        setupScrollWatcher(key, elements, dynImportPaths);
    }
}

/**
 * Modern lazy loading using IntersectionObserver (Chrome 61+, Safari 10.1+, FF 60+)
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
 * Fallback lazy loading using scroll events (for browsers without IntersectionObserver)
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
 * Cleanup lazy loading resources
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

/**
 * Scans DOM for elements with 'data-requires' attribute and loads modules.
 * @param {object|function} paths - Paths for resolving %location% (optional), or callback
 * @param {function} [callback] - Callback after all dynamic imports finish loading
 */
export function dynImports(paths, callback) {
    if (typeof paths === 'function') {
        callback = paths;
        paths = {};
    }

    const dynImportPaths = { ...defaultPaths, ...(paths || {}) };

    domScanner('requires', function (modules, deferred, totals) {
        const importPromises = [];

        // Process immediate modules using Object.entries for better performance
        for (const [key, elements] of Object.entries(modules)) {
            const path = rewritePath(key, dynImportPaths);
            hnlLogger.info(NAME, `Importing ${path.split('?')[0]}...`);

            importPromises.push(
                import(path)
                    .then(function(module) {
                        const name = moduleName(module, key);
                        hnlLogger.info(name, ' Imported.');

                        if (typeof module.init === 'function') {
                            hnlLogger.info(name, ` Initializing for ${elements.length} element(s).`);
                            try {
                                const result = module.init.call(module, elements);
                                if (result === false) {
                                    hnlLogger.warn(name, 'Module initialization returned: ' + result);
                                } else if (typeof result !== 'undefined') {
                                    hnlLogger.info(name, ' Initialized, module said: ' + result);
                                }
                            } catch (error) {
                                hnlLogger.error(name, 'Initialization failed: ' + error.message);
                            }
                        }
                    })
                    .catch(function(error) {
                        hnlLogger.error(NAME, error);
                    })
            );
        }

        Promise.allSettled(importPromises).then(function() {
            hnlLogger.info(NAME, 'All dynamic imports finished loading.');
            if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
                hnlLogger.info(NAME, { modules: modules, deferredModules: deferred });
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
 * Call this before destroying/unmounting in SPAs.
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

    hnlLogger.info(NAME, 'Cleanup complete.');
}