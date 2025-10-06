/**
 * Dynamic module importer v1.3.2 (Backward-Compatible - 2025)
 * (C) hnldesign 2022-2025
 *
 * -  Scans DOM for elements that have a 'data-requires' attribute set, with the required module as a variable
 * -  Queues up all modules found and then loads them in parallel
 * -  Has support for lazy loading via 'data-requires-lazy="true"' attributes,
 *    meaning the module will only get loaded when the requiring element has become visible.
 *    It will then try running the module's exported 'init' function if it has one.
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
const defaultPaths = {
    //'name'  :  'https://url.here'
}

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
        // Fallback for older browsers (Chrome 61+, Safari 10.1+)
        return Array.from(
            window.crypto.getRandomValues(new Uint8Array(16)),
            function(b) { return b.toString(16).padStart(2, '0'); }
        ).join('');
    }
    // Final fallback (should never reach here in module-capable browsers)
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

/**
 * Rewrites the path of the module, includes a site nonce if it exists.
 * Replaces %path% definitions if found in dynImportPaths config const.
 * @param {string} uri - The URI of the module to load.
 * @param {object} dynamicPaths - Path mappings
 * @returns {string} - The rewritten URI with the site nonce appended, if it exists.
 */
function rewritePath(uri, dynamicPaths) {
    const params = new URLSearchParams(uri.split('?')[1] || '');

    //check if path was preceded by a %path%, indicating a custom path to a uniform resource locator prefix
    const customPath = (new RegExp(/^%(.*?)%/gi).exec(uri));
    if (customPath && dynamicPaths[customPath[1]]) {
        uri = uri.replace(customPath[0] + '/', dynamicPaths[customPath[1]]);
    } else {
        if (typeof SITE_NONCE !== 'undefined') {
            params.append('nonce', SITE_NONCE);
        }
        uri = uri.replace('./', './../');
    }

    if (typeof window !== 'undefined' && window.location.search.includes('debug=true')) {
        params.append('debug', 'true');
        params.append('random', getRandomString());
    }

    const base = uri.split('?')[0];
    const query = params.toString();

    return query ? base + '?' + query : base;
}

/**
 * Gets the module name from either the exported NAME const, or the module's path (filename).
 * @param {object} module - The imported module
 * @param {string} path - The path of the module
 * @returns {string} The name of the module
 */
function moduleName(module, path) {
    if (typeof module.NAME !== 'undefined') return module.NAME;

    // Extract filename: 'js/modules/foo.mjs?debug=true' → 'foo.mjs'
    return path.split('/').pop().split('?')[0];
}

/**
 * Scans DOM for elements that have a 'data-requires' attribute set, with the required module as a variable.
 * Queues up all modules found and then loads them in parallel.
 * Has support for lazy loading via 'data-requires-lazy="true"' attributes,
 * meaning the module will only get loaded when the requiring element has become visible in the browser's viewport.
 * On loading, it will try invoking the module's exported 'init' function, if it has one.
 *
 * Example:
 * <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>
 *
 * @param {object|function} paths - Paths for resolving %location% (optional), or callback if first arg is function
 * @param {function} [callback] - A callback function to be executed after all dynamic imports have finished loading.
 */
export function dynImports(paths, callback) {
    // Handle overloaded function signature: dynImports(callback) or dynImports(paths, callback)
    if (typeof paths === 'function') {
        callback = paths;
        paths = {};
    }

    const dynImportPaths = { ...defaultPaths, ...(paths || {}) };

    domScanner('requires', function (modules, deferredModules, totals) {
        const importPromises = [];

        // Process modules found in DOM
        for (const key in modules) {
            if (!modules.hasOwnProperty(key)) continue;

            const elements = modules[key];
            const path = rewritePath(key, dynImportPaths);
            hnlLogger.info(NAME, 'Importing ' + path.split('?')[0] + '...');

            importPromises.push(
                import(path)
                    .then(function(module) {
                        const name = moduleName(module, key);
                        hnlLogger.info(name, ' Imported.');
                        if (typeof module.init === 'function') {
                            hnlLogger.info(name, ' Initializing for ' + elements.length + ' element(s).');
                            try {
                                const result = module.init.call(module, elements);
                                if (result === false) {
                                    hnlLogger.warn(name, 'Module initialization returned: ' + result);
                                } else if (typeof result !== 'undefined') {
                                    hnlLogger.info(name, ' Initialized, module said: ' + result);
                                } else {
                                    hnlLogger.info(name, ' Initialized.');
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

        // Wait for all imports to finish
        Promise.allSettled(importPromises).then(function() {
            hnlLogger.info(NAME, 'All dynamic imports finished loading.');
            hnlLogger.info(NAME, { modules: modules, deferredModules: deferredModules });
            if (typeof callback === 'function') {
                callback.call(this);
            }
        });

        // Process deferred modules (lazy-loaded)
        for (const key in deferredModules) {
            if (!deferredModules.hasOwnProperty(key)) continue;

            const elements = deferredModules[key];

            const watchModules = function() {
                // Skip if already loading/loaded
                if (!deferredModules[key] || deferredModules[key]._loading) return;

                for (let i = 0; i < elements.length; i++) {
                    const element = elements[i];
                    isVisible(element, function(visible) {
                        if (!visible || !deferredModules[key]) return;

                        // Set loading flag BEFORE starting import
                        deferredModules[key]._loading = true;

                        hnlLogger.info(NAME, `Element '${element.id || element.className || element.tagName}' visible, loading lazy module '${moduleName({}, key)}' and clearing watcher.`);
                        const path = rewritePath(key, dynImportPaths);

                        import(path)
                            .then(function(module) {
                                const name = moduleName(module, key);
                                hnlLogger.info(name, ' Imported (lazy).');
                                if (typeof module.init === 'function') {
                                    hnlLogger.info(name, ' Initializing (lazy) for ' + elements.length + ' element(s).');
                                    try {
                                        const result = module.init.call(module, elements);
                                        if (result === false) {
                                            hnlLogger.warn(name, 'Module initialization returned: ' + result);
                                        } else if (typeof result !== 'undefined') {
                                            hnlLogger.info(name, ' Initialized, module said: ' + result);
                                        } else {
                                            hnlLogger.info(name, ' Initialized.');
                                        }
                                    } catch (error) {
                                        hnlLogger.error(name, 'Initialization failed: ' + error.message);
                                    }
                                }
                                delete deferredModules[key];
                            })
                            .catch(function(error) {
                                hnlLogger.error(NAME, error);
                                delete deferredModules[key]; // Clean up on error too
                            });

                        eventHandler.removeListener('docShift', watchModules);
                    });
                }
            };

            // Bind to document shifts (scrolling, resizing, etc.)
            eventHandler.addListener('docShift', watchModules);
        }
    });
}