/**
 * Module registry for inter-module coordination
 */
import {logger} from './core.log.mjs';

export const NAME = 'registry';

/** @type {Map<string, {module, elements, state, loadedAt}>} */
const registry = new Map();

/** @type {Map<string, {promise, resolve, reject}>} */
const pending = new Map();

export const ModuleRegistry = {
    /**
     * Register a module after init() completes
     * @param {string} name - Module name (from NAME export)
     * @param {Object} module - Module exports
     * @param {HTMLElement[]} elements - Elements that required it
     * @param {string} state - 'loaded' or 'error'
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
     * Check if module is loaded successfully
     */
    isLoaded(name) {
        const entry = registry.get(name);
        return entry && entry.state === 'loaded';
    },

    /**
     * Get module exports (or null if not loaded)
     */
    get(name) {
        const entry = registry.get(name);
        return entry?.state === 'loaded' ? entry.module : null;
    },

    /**
     * Get elements that required this module
     */
    getElements(name) {
        return registry.get(name)?.elements || [];
    },

    /**
     * Wait for module to load AND verify it has api() interface
     * @param {string} name - Module name
     * @param {number} timeout - Max wait time (ms)
     * @returns {Promise<Object>} Resolves with module that has api() function
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
     * Remove module (for cleanup/SPA unmounting)
     */
    unregister(name) {
        registry.delete(name);
        if (pending.has(name)) {
            pending.get(name).reject(new Error(`Module unregistered: ${name}`));
            pending.delete(name);
        }
    },

    /**
     * Get all registered modules (debug)
     */
    getAll() {
        return Array.from(registry.entries()).map(([name, data]) => ({
            name,
            state: data.state,
            elementCount: data.elements.length
        }));
    }
};