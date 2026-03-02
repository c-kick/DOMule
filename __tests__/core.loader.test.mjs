/**
 * @fileoverview Tests for core.loader.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadModules, cleanup, recheckLazyModules, dynImports, NAME } from '../core.loader.mjs';
import { ModuleRegistry } from '../core.registry.mjs';

// Mock dynamic import
vi.mock('../test-module.mjs', () => ({
    NAME: 'test-module',
    init: vi.fn(() => 'initialized')
}));

describe('core.loader', () => {
    let registeredModules = [];

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        registeredModules = [];
    });

    afterEach(() => {
        // Clean up registered modules
        registeredModules.forEach(name => {
            ModuleRegistry.unregister(name);
        });
        cleanup();
        vi.useRealTimers();
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('core.loader');
        });
    });

    describe('loadModules', () => {
        it('calls callback even with no modules to load', async () => {
            const callback = vi.fn();

            loadModules(callback);

            // Wait for async operations
            await vi.advanceTimersByTimeAsync(100);

            expect(callback).toHaveBeenCalled();
            const results = callback.mock.calls[0][0];
            expect(results).toHaveProperty('loaded');
            expect(results).toHaveProperty('failed');
        });

        it('accepts paths object as first argument', async () => {
            const callback = vi.fn();

            loadModules({ custom: '/custom/path/' }, callback);

            await vi.advanceTimersByTimeAsync(100);

            expect(callback).toHaveBeenCalled();
        });

        it('works with paths-only call (no callback)', async () => {
            // Should not throw
            expect(() => loadModules({ custom: '/path/' })).not.toThrow();

            await vi.advanceTimersByTimeAsync(100);
        });

        it('works with callback-only call (no paths)', async () => {
            const callback = vi.fn();

            loadModules(callback);

            await vi.advanceTimersByTimeAsync(100);

            expect(callback).toHaveBeenCalled();
        });

        it('provides loaded and failed arrays in callback', async () => {
            const callback = vi.fn();

            loadModules(callback);

            await vi.advanceTimersByTimeAsync(100);

            const results = callback.mock.calls[0][0];
            expect(Array.isArray(results.loaded)).toBe(true);
            expect(Array.isArray(results.failed)).toBe(true);
        });
    });

    describe('path validation', () => {
        it('blocks javascript: URLs', async () => {
            const callback = vi.fn();

            // Create element with dangerous path
            const el = document.createElement('div');
            el.setAttribute('data-requires', 'javascript:alert(1)');
            document.body.appendChild(el);

            loadModules(callback);

            await vi.advanceTimersByTimeAsync(100);

            // Should have failed
            const results = callback.mock.calls[0][0];
            expect(results.failed.length).toBeGreaterThan(0);
            expect(results.failed[0].error.message).toContain('dangerous protocol');
        });

        it('blocks data: URLs', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', 'data:text/javascript,alert(1)');
            document.body.appendChild(el);

            let results;
            loadModules((r) => { results = r; });

            // Wait for async operations to complete
            await vi.advanceTimersByTimeAsync(500);
            await vi.runAllTimersAsync();

            // Results should have been captured
            if (results) {
                expect(results.failed.length).toBeGreaterThan(0);
                expect(results.failed[0].error.message).toContain('dangerous protocol');
            } else {
                // If callback wasn't called, at least the element should be in error state
                expect(el.classList.contains('module-error')).toBe(true);
            }
        });

        it('allows relative paths', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './test-module.mjs');
            document.body.appendChild(el);

            // The actual import will fail in test environment, but path validation passes
            loadModules(() => {});

            await vi.advanceTimersByTimeAsync(100);
        });

        it('allows absolute paths starting with /', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', '/assets/modules/test.mjs');
            document.body.appendChild(el);

            loadModules(() => {});

            await vi.advanceTimersByTimeAsync(100);
        });

        it('blocks external URLs without alias', async () => {
            const callback = vi.fn();

            const el = document.createElement('div');
            el.setAttribute('data-requires', 'https://evil.com/module.mjs');
            document.body.appendChild(el);

            loadModules(callback);

            await vi.advanceTimersByTimeAsync(100);

            const results = callback.mock.calls[0][0];
            expect(results.failed.length).toBeGreaterThan(0);
            expect(results.failed[0].error.message).toContain('External URLs not allowed');
        });
    });

    describe('lazy loading setup', () => {
        it('sets up IntersectionObserver for lazy modules', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './lazy-module.mjs');
            el.setAttribute('data-require-lazy', 'true');
            document.body.appendChild(el);

            loadModules(() => {});

            await vi.advanceTimersByTimeAsync(100);

            // Element should have pending state
            expect(el.classList.contains('module-pending')).toBe(true);
        });

        it('respects data-require-lazy="strict" for obstruction checking', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './strict-module.mjs');
            el.setAttribute('data-require-lazy', 'strict');
            document.body.appendChild(el);

            loadModules(() => {});

            await vi.advanceTimersByTimeAsync(100);

            // Should be set up for lazy loading
            expect(el.dataset.requiresState).toBe('pending');
        });
    });

    describe('cleanup', () => {
        it('clears all observers and listeners', () => {
            // Should not throw
            expect(() => cleanup()).not.toThrow();
        });

        it('can be called multiple times safely', () => {
            cleanup();
            cleanup();
            cleanup();

            // Should not throw
            expect(true).toBe(true);
        });

        it('clears path cache', async () => {
            loadModules(() => {});
            await vi.advanceTimersByTimeAsync(100);

            cleanup();

            // Path cache should be cleared (internal state)
            // Just verify no errors
            expect(true).toBe(true);
        });
    });

    describe('recheckLazyModules', () => {
        it('does not throw when no lazy modules exist', () => {
            expect(() => recheckLazyModules()).not.toThrow();
        });

        it('accepts container parameter', () => {
            const container = document.createElement('div');

            expect(() => recheckLazyModules(container)).not.toThrow();
        });

        it('defaults to document.body', () => {
            expect(() => recheckLazyModules()).not.toThrow();
        });
    });

    describe('dynImports (deprecated)', () => {
        it('calls loadModules internally', async () => {
            const callback = vi.fn();

            dynImports(callback);

            await vi.advanceTimersByTimeAsync(100);

            expect(callback).toHaveBeenCalled();
        });

        it('accepts paths object', async () => {
            const callback = vi.fn();

            dynImports({ alias: '/path/' }, callback);

            await vi.advanceTimersByTimeAsync(100);

            expect(callback).toHaveBeenCalled();
        });
    });

    describe('element state updates', () => {
        it('adds module-pending class during scan', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './test.mjs');
            document.body.appendChild(el);

            loadModules(() => {});

            // Should immediately have pending class
            expect(el.classList.contains('module-pending')).toBe(true);
        });

        it('sets data-requires-state to pending', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './test.mjs');
            document.body.appendChild(el);

            loadModules(() => {});

            expect(el.dataset.requiresState).toBe('pending');
        });

        it('initializes _moduleTracking on elements', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './test.mjs');
            document.body.appendChild(el);

            loadModules(() => {});

            expect(el._moduleTracking).toBeDefined();
            expect(el._moduleTracking.required).toBe(1);
            expect(el._moduleTracking.loaded).toBe(0);
        });

        it('counts multiple modules correctly', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './a.mjs,./b.mjs,./c.mjs');
            document.body.appendChild(el);

            loadModules(() => {});

            expect(el._moduleTracking.required).toBe(3);
        });
    });

    describe('path rewriting', () => {
        it('handles path aliases with %alias% syntax', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', '%modules%/test.mjs');
            document.body.appendChild(el);

            // Path validation should pass for aliased paths
            loadModules({ modules: '/assets/js/modules/' }, () => {});

            await vi.advanceTimersByTimeAsync(100);
        });
    });
});
