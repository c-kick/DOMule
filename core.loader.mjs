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
import {isVisible, isUnobstructed} from "./util.observe.mjs";
import {logger} from "./core.log.mjs";
import eventHandler from "./core.events.mjs";
import {ModuleRegistry} from './core.registry.mjs';
import {telemetry} from "./core.telemetry.mjs";

export const NAME = 'core.loader';

// ============================================================================
// CONSTANTS
// ============================================================================

/** @const {number} Debounce delay for mutation-triggered visibility checks (ms) */
const MUTATION_DEBOUNCE_MS = 50;

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
 * Updates module load state for elements.
 *
 * State transitions:
 * - pending → loading (lazy only, set by importModule)
 * - pending/loading → loaded (when all required modules complete)
 * - pending/loading → error (on any module failure)
 *
 * Uses counter: el._moduleTracking = {required: N, loaded: 0}
 * Set by core.scanner.mjs, incremented here on success.
 *
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

/**
 * Validates module path for security.
 * Blocks potentially dangerous paths like javascript: URLs or arbitrary external URLs.
 *
 * @private
 * @param {string} path - Module path to validate
 * @param {Object<string, string>} dynamicPaths - Configured path aliases
 * @returns {{valid: boolean, reason?: string}} Validation result
 */
function validateModulePath(path, dynamicPaths) {
    if (!path || typeof path !== 'string') {
        return { valid: false, reason: 'Path must be a non-empty string' };
    }

    const trimmed = path.trim().toLowerCase();

    // Block dangerous protocols
    if (trimmed.startsWith('javascript:') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('vbscript:')) {
        return { valid: false, reason: `Blocked dangerous protocol: ${path}` };
    }

    // Allow relative paths
    if (path.startsWith('./') || path.startsWith('../')) {
        return { valid: true };
    }

    // Allow configured aliases
    const aliasMatch = /^%([^%]+)%/.exec(path);
    if (aliasMatch && dynamicPaths[aliasMatch[1]]) {
        return { valid: true };
    }

    // Allow absolute paths starting with /
    if (path.startsWith('/')) {
        return { valid: true };
    }

    // Block absolute URLs (http://, https://, //) unless explicitly allowed
    // Users can use aliases to configure allowed CDN origins
    if (/^(https?:)?\/\//i.test(path)) {
        return {
            valid: false,
            reason: `External URLs not allowed. Use path aliases to configure allowed origins: ${path}`
        };
    }

    // Allow bare module paths (no protocol, no slash prefix)
    return { valid: true };
}

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

/**
 * Records module load metrics for telemetry dashboard.
 * Queries Performance API for transfer size, duration, cache status.
 *
 * @private
 * @param {string} name - Module name (from NAME export)
 * @param {string} path - Rewritten module path
 * @param {HTMLElement[]} elements - Elements that required module
 * @returns {Object|null} Metrics object or null if telemetry disabled
 */
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
// MODULE IMPORT LOGIC
// ============================================================================

/**
 * Attempts module import with exponential backoff retry logic.
 * @private
 * @param {string} path - Module path to import
 * @param {Object} config - Retry configuration
 * @param {number} attempt - Current attempt number (1-indexed)
 * @returns {Promise<Object>} Module exports
 */
async function retryImport(path, config, attempt = 1) {
    try {
        return await import(path);
    } catch (error) {
        if (attempt >= config.maxAttempts) {
            throw error; // Final attempt failed
        }

        const baseDelay = config.backoff[attempt - 1] || config.backoff[config.backoff.length - 1];
        const jitter = config.jitter ? Math.random() * 100 : 0;
        const delay = baseDelay + jitter;

        logger.warn(NAME, `Import attempt ${attempt}/${config.maxAttempts} failed for ${path}, retrying in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return retryImport(path, config, attempt + 1);
    }
}

/**
 * Core module import logic shared by immediate and lazy loading.
 * Handles minified fallback, metrics, initialization, and registry.
 *
 * @private
 * @param {string} key - Module path key from data-requires
 * @param {HTMLElement[]} elements - Elements requiring this module
 * @param {Object<string, string>} dynImportPaths - Path alias mappings
 * @param {boolean} [isLazy=false] - Whether this is lazy-loaded
 * @param {HTMLElement} [triggeringElement] - Element that triggered lazy load
 * @returns {Promise<Object>} Resolves with module exports
 */
function importModule(key, elements, dynImportPaths, isLazy = false, triggeringElement = null) {
    // Security: validate path before import
    const validation = validateModulePath(key, dynImportPaths);
    if (!validation.valid) {
        logger.error(NAME, `Security: ${validation.reason}`);
        updateModuleState(elements, true);
        return Promise.reject(new Error(validation.reason));
    }

    const path = rewritePath(key, dynImportPaths);
    const retryConfig = {
        maxAttempts: 3,
        backoff: [100, 500, 2000], // ms
        jitter: true
    };

    // Logging differs slightly between lazy and immediate
    if (isLazy) {
        const elementId = triggeringElement.id || triggeringElement.className || triggeringElement.tagName;
        logger.info(NAME, `Requiring element became visible for module "${moduleName({}, key)}", now loading.`);

        elements.forEach(el => {
            el.classList.remove('module-pending');
            el.classList.add('module-loading');
            el.dataset.requiresState = 'loading';
        });

    } else {
        logger.info(NAME, `Importing ${path.split('?')[0]}...`);
    }

    return import(path)
        .catch((error) => {
            // Minified fallback
            if (path.includes('.min.mjs') && !DEBUG) {
                console.info(NAME, `Minified unavailable, retrying unminified: ${key}`); //console info, as DEBUG would be false here
                const unminifiedPath = rewritePath(key, dynImportPaths, true);
                return retryImport(unminifiedPath, retryConfig);
            }
            throw error;
        })
        .then((module) => {
            const name = moduleName(module, key);
            const metrics = recordModuleMetrics(name, path, elements);

            // Log with context
            const loadType = isLazy ? ' (lazy)' : '';
            if (metrics) {
                const sizeKB = (metrics.size / 1024).toFixed(1);
                const cacheStatus = metrics.cached ? 'cached' : 'uncached';
                logger.info(name, `Imported${loadType}. (${sizeKB}KB, ${cacheStatus})`);
            } else {
                logger.info(name, `Imported${loadType}.`);
            }

            // Update state
            updateModuleState(elements);

            // Initialize if present
            if (typeof module.init === 'function') {
                logger.info(name, `Initializing${loadType} for ${elements.length} element(s).`);

                // Attach lazy context if needed
                if (isLazy) {
                    elements.triggeringElement = triggeringElement;
                }

                try {
                    const result = module.init.call(module, elements);
                    ModuleRegistry.register(name, module, elements, 'loaded');

                    if (result === false) {
                        logger.warn(name, `Initialization returned: ${result}`);
                    } else if (typeof result !== 'undefined') {
                        logger.info(name, `Initialized, module said: ${result}`);
                    }
                } catch (error) {
                    ModuleRegistry.register(name, module, elements, 'error');
                    logger.error(name, `Initialization failed: ${error.message}`);
                } finally {
                    // Clean up lazy context
                    if (isLazy) {
                        delete elements.triggeringElement;
                    }
                }
            }

            return module;
        })
        .catch((error) => {
            logger.error(NAME, `Failed to load ${key}: ${error.message}\nPath used: ${path} (${key})`);
            updateModuleState(elements, true);
            throw error;
        });
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
function importLazy(key, elements, triggeringElement, dynImportPaths, cleanupCallback) {
    if (!deferredModules[key] || deferredModules[key]._loading) return;

    deferredModules[key]._loading = true;

    importModule(key, elements, dynImportPaths, true, triggeringElement)
        .finally(cleanupCallback);
}

/**
 * Routes lazy loading to IntersectionObserver (modern) or scroll watcher (fallback).
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements requiring module
 * @param {Object<string, string>} dynImportPaths - Path mappings
 */
function setupLazyLoading(key, elements, dynImportPaths, checkObstructions) {
    logger.info(NAME, `Setting up ${(typeof IntersectionObserver !== 'undefined') ? 'IntersectionObserver' : 'scrollWatcher'} for lazy module: ${key}`);
    if (typeof IntersectionObserver !== 'undefined') {
        setupIntersectionWatcher(key, elements, dynImportPaths, checkObstructions);
    } else {
        setupScrollWatcher(key, elements, dynImportPaths, checkObstructions);
    }
}

/**
 * Modern lazy loading using IntersectionObserver API.
 * Handles CSS transitions/animations that delay element visibility by:
 * - IntersectionObserver for viewport detection
 * - MutationObserver for style/class changes on element + ancestors
 * - Document-delegated animation/transitionend listeners for delayed visibility
 * - requestAnimationFrame to read committed computed styles
 *
 * Supported: Chrome 51+, Safari 12.1+, Firefox 55+, Edge 15+
 *
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements to observe
 * @param {Object<string, string>} dynImportPaths - Path mappings
 * @param {boolean} checkObstructions - Whether to verify unobstructed pixels
 */
function setupIntersectionWatcher(key, elements, dynImportPaths, checkObstructions = false) {
    // ========================================================================
    // STATE
    // ========================================================================

    const intersectionObservers = [];
    const mutationObservers = [];
    let loadingInProgress = false;
    let mutationTimer = null;
    let listenersAttached = false;

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Loads module and performs cleanup.
     * @private
     */
    const loadAndCleanup = (triggeringElement) => {
        loadingInProgress = true;
        deferredModules[key]._loading = true;

        // Cleanup all watchers
        clearTimeout(mutationTimer);
        intersectionObservers.forEach(obs => obs.disconnect());
        mutationObservers.forEach(mut => mut.disconnect());

        if (listenersAttached) {
            document.removeEventListener('animationend', delegatedHandler, true);
            document.removeEventListener('transitionend', delegatedHandler, true);
        }

        // Load module
        importModule(key, elements, dynImportPaths, true, triggeringElement)
            .finally(() => {
                lazyObservers.delete(key);
                delete deferredModules[key];
            });
    };

    /**
     * Checks if element is visible and ready to load.
     * Returns true if visible (and triggers load), false if needs watching.
     * @private
     * @returns {boolean} True if visible and loading triggered
     */
    const checkVisibility = (element) => {
        if (loadingInProgress || deferredModules[key]?._loading) {
            return true; // Already loading, consider "handled"
        }

        const observerEntry = intersectionObservers.find(o => o.target === element)?.lastEntry;

        // Viewport check
        const inViewport = observerEntry
            ? observerEntry.intersectionRatio > 0
            : (() => {
                const rect = element.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0;
            })();

        if (!inViewport) return false;

        // Rendered visibility check
        const computed = getComputedStyle(element);
        const isRendered = computed.display !== 'none'
            && computed.visibility !== 'hidden'
            && parseFloat(computed.opacity) > 0;

        if (!isRendered) return false;

        // Obstruction check
        if (checkObstructions && !isUnobstructed(element)) return false;

        // Visible - trigger load
        loadAndCleanup(element);
        return true;
    };

    /**
     * Wrapped checkVisibility for rAF context.
     * @private
     */
    const checkVisibilityAsync = (element) => {
        window.requestAnimationFrame(() => {
            checkVisibility(element);
        });
    };

    /**
     * Debounced mutation handler.
     * @private
     */
    const debouncedCheck = (element) => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => checkVisibilityAsync(element), MUTATION_DEBOUNCE_MS);
    };

    /**
     * Delegated handler for animation/transition completion.
     * @private
     */
    const delegatedHandler = (e) => {
        elements.forEach(element => {
            if (e.target.contains(element) || e.target === element) {
                checkVisibilityAsync(element);
            }
        });
    };

    /**
     * Sets up all observers and event listeners.
     * @private
     */
    const setupWatchers = () => {
        elements.forEach(element => {
            // IntersectionObserver
            const intersectionObs = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    intersectionObs.lastEntry = entry;
                    if (entry.intersectionRatio > 0) {
                        checkVisibilityAsync(element);
                    }
                });
            }, {
                rootMargin: '50px',
                threshold: [0, 0.1, 1]
            });

            intersectionObs.target = element;
            intersectionObs.observe(element);
            intersectionObservers.push(intersectionObs);

            // MutationObserver for element + ancestors
            const mutationObs = new MutationObserver(() => {
                debouncedCheck(element);
            });

            let node = element;
            while (node && node !== document.body) {
                mutationObs.observe(node, {
                    attributes: true,
                    attributeFilter: ['style', 'class'],
                    attributeOldValue: false
                });
                node = node.parentElement;
            }

            mutationObservers.push(mutationObs);
        });

        // Document-delegated animation/transition listeners
        document.addEventListener('animationend', delegatedHandler, { passive: true, capture: true });
        document.addEventListener('transitionend', delegatedHandler, { passive: true, capture: true });
        listenersAttached = true;

        // Store for cleanup
        lazyObservers.set(key, { observers: intersectionObservers, mutationObservers });
    };

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    // Initial visibility check
    requestAnimationFrame(() => {
        let anyNeedsWatching = false;

        elements.forEach(element => {
            if (!checkVisibility(element)) {
                anyNeedsWatching = true;
            }
        });

        // Set up watchers only if needed
        if (anyNeedsWatching && !loadingInProgress) {
            setupWatchers();
        }
    });
}

/**
 * Fallback lazy loading using scroll events for browsers without IntersectionObserver.
 * Used for Safari 10.1-12.0 (supports ES6 modules but not IntersectionObserver).
 *
 * @private
 * @param {string} key - Module path key
 * @param {HTMLElement[]} elements - Elements to watch
 * @param {Object<string, string>} dynImportPaths - Path mappings
 * @param {boolean} checkObstructions - Whether to verify unobstructed pixels
 */
function setupScrollWatcher(key, elements, dynImportPaths, checkObstructions = false) {
    const watchModules = function() {
        if (!deferredModules[key] || deferredModules[key]._loading) return;

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // Legacy visibility check
            isVisible(element, function(visible) {
                if (!visible) return;

                // Additional obstruction check if requested
                if (checkObstructions && !isUnobstructed(element)) {
                    return;
                }

                deferredModules[key]._loading = true;

                importModule(key, elements, dynImportPaths, true, element)
                    .finally(() => {
                        // Cleanup
                        eventHandler.removeListener('docShift', watchModules);
                        lazyListeners.delete(key);
                        delete deferredModules[key];
                    });
            });
        }
    };

    lazyListeners.set(key, watchModules);
    eventHandler.addListener('docShift', watchModules);

    // Check immediately in case elements are already visible
    watchModules();
}

/**
 * Removes observers/listeners and clears deferred module state.
 * @private
 * @param {string} key - Module path key
 * @param {IntersectionObserver|null} observer - Observer to disconnect
 * @param {Function|null} listener - Event listener to remove
 */
function cleanupLazyModule(key, observer, scrollListener, transitionListener, animationListener) {
    for (const {observers, mutationObservers} of lazyObservers.values()) {
        observers?.forEach(obs => obs.disconnect());
        mutationObservers?.forEach(mut => mut.disconnect());
    }
    lazyObservers.clear();

    if (scrollListener) {
        eventHandler.removeListener('docShift', scrollListener);
    }
    if (transitionListener && animationListener) {
        const elements = deferredModules[key];
        elements.forEach(el => {
            el.removeEventListener('transitionend', transitionListener);
            el.removeEventListener('animationend', animationListener);
        });
    }
    lazyListeners.delete(key);
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
 * loadModules(() => {
 *   console.log('All modules loaded');
 * });
 *
 * @example
 * // With path aliases
 * loadModules({
 *   'assets': 'https://cdn.example.com/js/',
 *   'vendor': 'https://unpkg.com/'
 * }, () => {
 *   console.log('Modules loaded');
 * });
 */
export function loadModules(paths, callback) {
    if (typeof paths === 'function') {
        callback = paths;
        paths = {};
    }

    const dynImportPaths = { ...defaultPaths, ...(paths || {}) };

    domScanner(function (modules, deferred, totals) {
        const importPromises = [];

        // Process immediate modules using Object.entries for better performance
        for (const [key, elements] of Object.entries(modules)) {
            importPromises.push(
                importModule(key, elements, dynImportPaths, false)
            );
        }

        Promise.allSettled(importPromises).then(function() {
            logger.info(NAME, 'All dynamic imports finished loading.');
            logger.info(NAME, { modules: modules, deferredModules: deferred });
            if (typeof callback === 'function') {
                callback.call(this);
            }
        });

        // Setup lazy loading for deferred modules
        for (const [key, elements] of Object.entries(deferred)) {
            deferredModules[key] = elements;

            // Parse lazy mode: true|"loose" → false, "strict" → true
            const checkObstructions = elements.some(el =>
                el.dataset.requireLazy === 'strict'
            );

            setupLazyLoading(key, elements, dynImportPaths, checkObstructions);
        }
    });
}

/**
 * Force visibility check for lazy-loaded modules in a container
 * @param {Element} container - Container whose children should be rechecked
 * @public
 */
export function recheckLazyModules(container = document.body) {
    if (!intersectionObserver) return;

    window.requestAnimationFrame(() => {
        const lazyElements = container.querySelectorAll('[data-require-lazy="strict"]');
        lazyElements.forEach(el => {
            // Temporarily disconnect and reconnect to force recalculation
            intersectionObserver.unobserve(el);
            intersectionObserver.observe(el);
        });
    })
}

/**
 * @deprecated Use loadModules() instead. Retained for v3.x compatibility.
 * Will be removed in v4.0.0.
 */
export function dynImports(...args) {
    if (DEBUG) {
        logger.warn(NAME, 'dynImports() is deprecated, use loadModules()');
    }
    return loadModules(...args);
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