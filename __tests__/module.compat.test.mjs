/**
 * @fileoverview DOMule Module Compatibility Test
 *
 * Tests if a module is compatible with the DOMule loader system.
 * Checks for NAME export, init(), api(), and destroy() functions.
 *
 * Usage:
 *   Linux/Mac:   MODULE=./modules/mymodule.mjs npm run test:module
 *   Windows CMD: set MODULE=./modules/mymodule.mjs && npm run test:module
 *   PowerShell:  $env:MODULE="./modules/mymodule.mjs"; npm run test:module
 *
 * Or without the shortcut:
 *   MODULE=./modules/mymodule.mjs npm test -- __tests__/module.compat.test.mjs
 *
 * If no MODULE is specified, tests the _template.mjs as default.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleRegistry } from '../core.registry.mjs';

// ============================================================================
// MODULE PATH - Set via environment variable or defaults to template
// ============================================================================

const MODULE_PATH = process.env.MODULE
    ? `../${process.env.MODULE.replace(/^\.\//, '')}`
    : '../modules/_template.mjs';

// ============================================================================
// COMPATIBILITY TEST SUITE
// ============================================================================

describe('DOMule Module Compatibility', () => {
    let module;
    let testElements = [];

    function createElement(options = {}) {
        const el = document.createElement(options.tag || 'div');
        if (options.id) el.id = options.id;
        if (options.content) el.innerHTML = options.content;
        document.body.appendChild(el);
        testElements.push(el);
        return el;
    }

    beforeEach(async () => {
        document.body.innerHTML = '';
        testElements = [];

        // Dynamic import to allow changing MODULE_PATH
        module = await import(MODULE_PATH);
    });

    afterEach(() => {
        testElements.forEach(el => el.remove());
        if (module?.NAME) {
            ModuleRegistry.unregister(module.NAME);
        }
        vi.restoreAllMocks();
    });

    // =========================================================================
    // REQUIRED: NAME export
    // =========================================================================

    describe('NAME export (required)', () => {
        it('exports NAME as a non-empty string', () => {
            expect(module.NAME).toBeDefined();
            expect(typeof module.NAME).toBe('string');
            expect(module.NAME.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // OPTIONAL: init() function
    // =========================================================================

    describe('init() function (optional)', () => {
        it('if exported, is a function', () => {
            if (module.init === undefined) {
                // No init - that's fine, skip
                expect(true).toBe(true);
                return;
            }
            expect(typeof module.init).toBe('function');
        });

        it('if exported, accepts (elements, context) parameters', () => {
            if (typeof module.init !== 'function') return;

            const el = createElement({ id: 'test-element' });

            // Should not throw
            expect(() => module.init([el], null)).not.toThrow();
        });

        it('if exported, handles empty element array', () => {
            if (typeof module.init !== 'function') return;

            expect(() => module.init([], null)).not.toThrow();
        });

        it('if exported, handles lazy-load context', () => {
            if (typeof module.init !== 'function') return;

            const el = createElement();
            const context = { isLazy: true, triggeringElement: el };

            expect(() => module.init([el], context)).not.toThrow();
        });

        it('if exported, does not return false (indicates failure)', () => {
            if (typeof module.init !== 'function') return;

            const el = createElement();
            const result = module.init([el], null);

            expect(result).not.toBe(false);
        });
    });

    // =========================================================================
    // OPTIONAL: api() function
    // =========================================================================

    describe('api() function (optional)', () => {
        it('if exported, is a function', () => {
            if (module.api === undefined) {
                expect(true).toBe(true);
                return;
            }
            expect(typeof module.api).toBe('function');
        });

        it('if exported, handles unknown actions gracefully', () => {
            if (typeof module.api !== 'function') return;

            // Initialize first if init exists
            if (typeof module.init === 'function') {
                module.init([createElement()], null);
            }

            // Should not throw on unknown action
            expect(() => module.api('__unknown_action_test__')).not.toThrow();
        });
    });

    // =========================================================================
    // OPTIONAL: destroy() function
    // =========================================================================

    describe('destroy() function (optional)', () => {
        it('if exported, is a function', () => {
            if (module.destroy === undefined) {
                expect(true).toBe(true);
                return;
            }
            expect(typeof module.destroy).toBe('function');
        });

        it('if exported, can be called without throwing', () => {
            if (typeof module.destroy !== 'function') return;

            // Initialize first
            if (typeof module.init === 'function') {
                module.init([createElement()], null);
            }

            expect(() => module.destroy()).not.toThrow();
        });
    });

    // =========================================================================
    // REGISTRY COMPATIBILITY
    // =========================================================================

    describe('ModuleRegistry compatibility', () => {
        it('can be registered in ModuleRegistry', () => {
            const el = createElement();

            ModuleRegistry.register(module.NAME, module, [el], 'loaded');

            expect(ModuleRegistry.isLoaded(module.NAME)).toBe(true);
            expect(ModuleRegistry.get(module.NAME)).toBe(module);
        });

        it('can be retrieved via waitFor if api() exists', async () => {
            if (typeof module.api !== 'function') {
                expect(true).toBe(true);
                return;
            }

            const el = createElement();
            ModuleRegistry.register(module.NAME, module, [el], 'loaded');

            const result = await ModuleRegistry.waitFor(module.NAME, 1000);
            expect(result).toBe(module);
        });
    });
});
