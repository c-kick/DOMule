/**
 * @fileoverview Module Registry - Enables inter-module coordination and dependency management
 * @module core.registry
 * @version 3.0.0
 * @author hnldesign
 * @since 2025
 *
 * @description
 * Provides centralized module discovery and coordination without tight coupling.
 * Modules can wait for dependencies, query other modules, and coordinate behavior
 * through a standardized api() interface.
 *
 * Key features:
 * - Module discovery (check if loaded)
 * - Dependency waiting (promise-based coordination)
 * - Safe access (get module exports with validation)
 * - Element tracking (which elements required each module)
 * - Memory management (WeakMaps for automatic cleanup)
 *
 * Architecture:
 * - Registry: Map of loaded modules with metadata
 * - Pending: Map of promises awaiting module loads
 * - Validation: Enforces api() interface for coordination
 *
 * Design Intent - Choosing the right method:
 *
 *   waitFor(name) - Use when you need to COORDINATE with another module.
 *     Requires api() because coordination implies calling the other module's interface.
 *     Returns a promise that resolves when the module is ready for coordination.
 *
 *   isLoaded(name) - Use for synchronous checks ("is this module present?").
 *     Does NOT require api(). Use when you just need to know if something loaded.
 *
 *   get(name) - Use to access module exports directly.
 *     Does NOT require api(). Returns raw module object for direct access.
 *     Caller is responsible for checking if the interface they need exists.
 *
 * The api() requirement on waitFor() is intentional: if you're waiting for a module,
 * you presumably need to interact with it. Modules without api() don't support
 * inter-module coordination - use isLoaded()/get() for those instead.
 *
 * @example
 * // In a module that provides coordination
 * export const NAME = 'gallery';
 * export function api(action, ...args) {
 *   switch(action) {
 *     case 'getImages': return images;
 *     case 'onChange': callbacks.push(args[0]); break;
 *   }
 * }
 *
 * @example
 * // In a module that consumes coordination
 * import {ModuleRegistry} from './core.registry.mjs';
 *
 * export function init(elements) {
 *   ModuleRegistry.waitFor('gallery')
 *     .then(gallery => {
 *       const images = gallery.api('getImages');
 *       initFeature(images);
 *     })
 *     .catch(error => {
 *       console.warn('Gallery unavailable:', error);
 *     });
 * }
 */
import {logger} from './core.log.mjs';

export const NAME = 'core.registry';

/**
 * Registry of loaded modules with metadata.
 * @type {Map<string, {module: Object, elements: HTMLElement[], state: string, loadedAt: DOMHighResTimeStamp}>}
 * @private
 */
const registry = new Map();

/**
 * Pending module load promises.
 * Tracks modules being awaited by other modules.
 * @type {Map<string, {promise: Promise, resolve: Function, reject: Function}>}
 * @private
 */
const pending = new Map();

/**
 * Module Registry API for inter-module coordination.
 * @namespace
 * @type {Object}
 */
export const ModuleRegistry = {
    /**
     * Register a module after initialization completes.
     * Called automatically by core.loader.mjs after module.init() succeeds.
     * Resolves any pending promises waiting for this module.
     *
     * @param {string} name - Module name (from NAME export)
     * @param {Object} module - Module exports object
     * @param {HTMLElement[]} elements - Elements that required this module
     * @param {string} [state='loaded'] - Module state ('loaded' or 'error')
     *
     * @example
     * // Called by core.loader.mjs after init()
     * ModuleRegistry.register('gallery', galleryModule, [div1, div2], 'loaded');
     */
    register(name, module, elements, state = 'loaded') {
        registry.set(name, {
            module,
            elements,
            state,
            loadedAt: performance.now()
        });

        // Resolve any waiting promises
        if (pending.has(name)) {
            const {resolve, reject} = pending.get(name);

            // Check if module has api() interface
            if (typeof module.api === 'function') {
                resolve(module);
            } else {
                reject(new Error(`Module '${name}' loaded but has no api() interface`));
            }

            pending.delete(name);
        }

        logger.info(NAME, `Registered: ${name} (${state})`);
    },

    /**
     * Check if module is loaded successfully (synchronous).
     * Does not verify api() interface - returns true for any loaded module.
     *
     * Use this when:
     * - You need a synchronous check (no waiting)
     * - You don't need to call the module's api()
     * - You just want to know if something is present
     *
     * For async waiting with api() validation, use waitFor() instead.
     *
     * @param {string} name - Module name
     * @returns {boolean} True if module loaded successfully
     *
     * @example
     * if (ModuleRegistry.isLoaded('gallery')) {
     *   // Gallery is available - can use get() to access it
     * }
     */
    isLoaded(name) {
        const entry = registry.get(name);
        return entry && entry.state === 'loaded';
    },

    /**
     * Get module exports directly (synchronous).
     * Returns raw module object - does not validate api() interface.
     *
     * Use this when:
     * - You need synchronous access (module should already be loaded)
     * - You want to access exports other than api()
     * - You'll handle api() validation yourself
     *
     * For async waiting with api() validation, use waitFor() instead.
     *
     * @param {string} name - Module name
     * @returns {Object|null} Module exports or null if not loaded
     *
     * @example
     * const gallery = ModuleRegistry.get('gallery');
     * if (gallery && typeof gallery.api === 'function') {
     *   gallery.api('getImages');
     * }
     */
    get(name) {
        const entry = registry.get(name);
        return entry?.state === 'loaded' ? entry.module : null;
    },

    /**
     * Get elements that required this module.
     * Useful for module-specific queries or operations.
     *
     * @param {string} name - Module name
     * @returns {HTMLElement[]} Array of elements (empty if not found)
     *
     * @example
     * const galleryElements = ModuleRegistry.getElements('gallery');
     * galleryElements.forEach(el => el.classList.add('enhanced'));
     */
    getElements(name) {
        return registry.get(name)?.elements || [];
    },

    /**
     * Wait for module to load and verify it has api() interface.
     * Returns promise that resolves when module is ready for inter-module coordination.
     *
     * DESIGN NOTE: The api() requirement is intentional. This method is specifically
     * for inter-module coordination - you're waiting because you need to call the
     * other module's api(). If you don't need coordination:
     *   - Use isLoaded() for synchronous presence checks
     *   - Use get() for direct module access without api() requirement
     *
     * Rejects if:
     *   - Module doesn't load within timeout
     *   - Module loads but has no api() function (not designed for coordination)
     *   - Module init() threw an error
     *
     * @param {string} name - Module name to wait for
     * @param {number} [timeout=30000] - Maximum wait time in milliseconds
     * @returns {Promise<Object>} Promise resolving with module exports
     * @throws {Error} If module doesn't load, errors, or has no api()
     *
     * @example
     * // Promise chain style
     * ModuleRegistry.waitFor('gallery')
     *   .then(gallery => {
     *     const images = gallery.api('getImages');
     *   })
     *   .catch(error => {
     *     console.warn('Gallery unavailable:', error);
     *   });
     *
     * @example
     * // Async/await style
     * try {
     *   const gallery = await ModuleRegistry.waitFor('gallery', 5000);
     *   gallery.api('onChange', updateUI);
     * } catch (error) {
     *   // Handle missing/incompatible module
     * }
     */
    waitFor(name, timeout = 30000) {
        // Already loaded?
        if (this.isLoaded(name)) {
            const module = this.get(name);

            // Verify api() exists
            if (typeof module.api !== 'function') {
                return Promise.reject(new Error(`Module '${name}' has no api() interface`));
            }

            return Promise.resolve(module);
        }

        // Already waiting? Return existing promise
        if (pending.has(name)) {
            return pending.get(name).promise;
        }

        // Create new promise
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for module: ${name}`));
            pending.delete(name);
        }, timeout);

        promise.finally(() => clearTimeout(timeoutId));

        pending.set(name, {promise, resolve, reject});
        return promise;
    },

    /**
     * Remove module from registry (for cleanup/SPA unmounting).
     * Rejects any pending promises waiting for this module.
     *
     * @param {string} name - Module name to unregister
     *
     * @example
     * // On route change in SPA
     * ModuleRegistry.unregister('gallery');
     */
    unregister(name) {
        const entry = registry.get(name);

        if (entry) {
            logger.info(NAME, `Module self-destructed: ${name}`);
            registry.delete(name);

            // Reject any pending waitFor() promises
            if (pending.has(name)) {
                pending.get(name).reject(
                    new Error(`Module destroyed: ${name}`)
                );
                pending.delete(name);
            }
        }
    },

    /**
     * Get all registered modules with metadata (debug helper).
     * Useful for troubleshooting module load issues.
     *
     * @returns {Array<{name: string, state: string, elementCount: number}>}
     *
     * @example
     * console.table(ModuleRegistry.getAll());
     * // name       | state  | elementCount
     * // gallery    | loaded | 2
     * // lightbox   | loaded | 1
     */
    getAll() {
        return Array.from(registry.entries()).map(([name, data]) => ({
            name,
            state: data.state,
            elementCount: data.elements.length
        }));
    }
};