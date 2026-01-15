/**
 * @fileoverview Integration tests for full DOMule loading flow
 *
 * Tests the complete flow: scanner -> loader -> registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { domScanner } from '../core.scanner.mjs';
import { ModuleRegistry } from '../core.registry.mjs';
import { loadModules, cleanup } from '../core.loader.mjs';

describe('Integration Tests', () => {
    let registeredModules = [];

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        registeredModules = [];
    });

    afterEach(() => {
        registeredModules.forEach(name => {
            ModuleRegistry.unregister(name);
        });
        cleanup();
        vi.useRealTimers();
    });

    describe('Scanner -> Loader Flow', () => {
        it('scanner prepares elements for loader', () => {
            // Create requiring elements
            const el1 = document.createElement('div');
            el1.setAttribute('data-requires', './module-a.mjs');
            document.body.appendChild(el1);

            const el2 = document.createElement('div');
            el2.setAttribute('data-requires', './module-b.mjs');
            el2.setAttribute('data-require-lazy', 'true');
            document.body.appendChild(el2);

            // Run scanner
            const { modules, deferred, stats } = domScanner();

            // Verify categorization
            expect(modules['./module-a.mjs']).toBeDefined();
            expect(deferred['./module-b.mjs']).toBeDefined();
            expect(stats.immediate).toBe(1);
            expect(stats.lazy).toBe(1);

            // Verify element state
            expect(el1.classList.contains('module-pending')).toBe(true);
            expect(el1.dataset.requiresState).toBe('pending');
            expect(el1._moduleTracking).toEqual({ required: 1, loaded: 0 });
        });

        it('multiple elements share same module', () => {
            const el1 = document.createElement('div');
            el1.id = 'el1';
            el1.setAttribute('data-requires', './shared.mjs');
            document.body.appendChild(el1);

            const el2 = document.createElement('div');
            el2.id = 'el2';
            el2.setAttribute('data-requires', './shared.mjs');
            document.body.appendChild(el2);

            const { modules } = domScanner();

            // Both elements should be in same module array
            expect(modules['./shared.mjs']).toHaveLength(2);
            expect(modules['./shared.mjs']).toContain(el1);
            expect(modules['./shared.mjs']).toContain(el2);
        });

        it('comma-separated modules create multiple entries', () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', './a.mjs,./b.mjs,./c.mjs');
            document.body.appendChild(el);

            const { modules, stats } = domScanner();

            expect(Object.keys(modules)).toHaveLength(3);
            expect(modules['./a.mjs']).toContain(el);
            expect(modules['./b.mjs']).toContain(el);
            expect(modules['./c.mjs']).toContain(el);

            // Element should track all 3 as required
            expect(el._moduleTracking.required).toBe(3);
        });
    });

    describe('Loader -> Registry Flow', () => {
        it('loader reports results via callback', async () => {
            const callback = vi.fn();

            loadModules(callback);

            await vi.advanceTimersByTimeAsync(200);

            expect(callback).toHaveBeenCalled();
            const results = callback.mock.calls[0][0];
            expect(results).toHaveProperty('loaded');
            expect(results).toHaveProperty('failed');
        });

        it('security validation prevents dangerous imports', async () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', 'javascript:evil()');
            document.body.appendChild(el);

            const callback = vi.fn();
            loadModules(callback);

            await vi.advanceTimersByTimeAsync(200);

            const results = callback.mock.calls[0][0];
            expect(results.failed.length).toBe(1);
            expect(results.failed[0].error.message).toContain('dangerous protocol');
        });
    });

    describe('Registry API', () => {
        it('modules can be registered and retrieved', () => {
            const name = 'test-integration-module';
            const module = {
                NAME: name,
                init: vi.fn(),
                api: vi.fn(() => 'api result')
            };
            const elements = [document.createElement('div')];
            registeredModules.push(name);

            ModuleRegistry.register(name, module, elements, 'loaded');

            expect(ModuleRegistry.isLoaded(name)).toBe(true);
            expect(ModuleRegistry.get(name)).toBe(module);
            expect(ModuleRegistry.getElements(name)).toEqual(elements);
        });

        it('waitFor resolves when module loads', async () => {
            const name = 'async-test-module';
            registeredModules.push(name);

            // Start waiting
            const waitPromise = ModuleRegistry.waitFor(name, 5000);

            // Register module after delay
            setTimeout(() => {
                ModuleRegistry.register(name, {
                    NAME: name,
                    api: () => 'result'
                }, [], 'loaded');
            }, 100);

            vi.advanceTimersByTime(150);

            const result = await waitPromise;
            expect(result.api()).toBe('result');
        });

        it('waitFor times out for missing modules', async () => {
            vi.useFakeTimers();

            const promise = ModuleRegistry.waitFor('never-exists', 500);

            vi.advanceTimersByTime(501);

            await expect(promise).rejects.toThrow(/Timeout/);

            vi.useRealTimers();
        });
    });

    describe('Full Lifecycle', () => {
        it('cleanup removes all state', async () => {
            // Set up elements
            const el = document.createElement('div');
            el.setAttribute('data-requires', './test.mjs');
            el.setAttribute('data-require-lazy', 'true');
            document.body.appendChild(el);

            // Start loading
            loadModules(() => {});
            await vi.advanceTimersByTimeAsync(100);

            // Cleanup should not throw
            expect(() => cleanup()).not.toThrow();

            // Can call again safely
            expect(() => cleanup()).not.toThrow();
        });

        it('modules track element counts correctly', () => {
            const name = 'counted-module';
            registeredModules.push(name);

            const el1 = document.createElement('div');
            const el2 = document.createElement('span');
            const el3 = document.createElement('section');

            ModuleRegistry.register(name, {}, [el1, el2, el3], 'loaded');

            const all = ModuleRegistry.getAll();
            const entry = all.find(m => m.name === name);

            expect(entry.elementCount).toBe(3);
        });
    });

    describe('Edge Cases', () => {
        it('handles empty data-requires', () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', '');
            document.body.appendChild(el);

            const { stats } = domScanner();

            expect(stats.total).toBe(0);
        });

        it('handles whitespace-only data-requires', () => {
            const el = document.createElement('div');
            el.setAttribute('data-requires', '   ');
            document.body.appendChild(el);

            const { stats } = domScanner();

            expect(stats.total).toBe(0);
        });

        it('handles deeply nested elements', () => {
            document.body.innerHTML = `
                <div data-requires="./level1.mjs">
                    <div data-requires="./level2.mjs">
                        <div data-requires="./level3.mjs">
                            <div data-requires="./level4.mjs"></div>
                        </div>
                    </div>
                </div>
            `;

            const { stats } = domScanner();

            expect(stats.immediate).toBe(4);
        });

        it('handles mixed lazy and immediate in same parent', () => {
            document.body.innerHTML = `
                <div id="parent">
                    <div data-requires="./immediate.mjs"></div>
                    <div data-requires="./lazy.mjs" data-require-lazy="true"></div>
                    <div data-requires="./another-immediate.mjs"></div>
                </div>
            `;

            const { modules, deferred, stats } = domScanner();

            expect(stats.immediate).toBe(2);
            expect(stats.lazy).toBe(1);
            expect(modules['./immediate.mjs']).toBeDefined();
            expect(modules['./another-immediate.mjs']).toBeDefined();
            expect(deferred['./lazy.mjs']).toBeDefined();
        });

        it('same module can be both lazy and immediate from different elements', () => {
            const el1 = document.createElement('div');
            el1.setAttribute('data-requires', './shared.mjs');
            document.body.appendChild(el1);

            const el2 = document.createElement('div');
            el2.setAttribute('data-requires', './shared.mjs');
            el2.setAttribute('data-require-lazy', 'true');
            document.body.appendChild(el2);

            const { modules, deferred } = domScanner();

            // Element without lazy goes to immediate
            expect(modules['./shared.mjs']).toContain(el1);

            // Element with lazy goes to deferred
            expect(deferred['./shared.mjs']).toContain(el2);
        });
    });

    describe('Observer Mock Usage', () => {
        it('IntersectionObserver mock tracks observed elements', () => {
            const callback = vi.fn();
            const observer = new IntersectionObserver(callback);

            const el1 = document.createElement('div');
            const el2 = document.createElement('div');

            observer.observe(el1);
            observer.observe(el2);

            expect(observer.elements.has(el1)).toBe(true);
            expect(observer.elements.has(el2)).toBe(true);

            observer.unobserve(el1);
            expect(observer.elements.has(el1)).toBe(false);

            observer.disconnect();
            expect(observer.elements.size).toBe(0);
        });

        it('ResizeObserver mock tracks observed elements', () => {
            const callback = vi.fn();
            const observer = new ResizeObserver(callback);

            const el = document.createElement('div');

            observer.observe(el);
            expect(observer.elements.has(el)).toBe(true);

            observer.disconnect();
            expect(observer.elements.size).toBe(0);
        });
    });
});
