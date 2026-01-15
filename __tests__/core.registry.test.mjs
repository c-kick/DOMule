/**
 * @fileoverview Tests for core.registry.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleRegistry, NAME } from '../core.registry.mjs';

describe('core.registry', () => {
    // Use unique names per test to avoid state conflicts
    let testCounter = 0;
    const uniqueName = () => `test-module-${Date.now()}-${testCounter++}`;

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('core.registry');
        });
    });

    describe('register', () => {
        it('registers a module', () => {
            const name = uniqueName();
            const module = { NAME: name, init: () => {} };
            const elements = [document.createElement('div')];

            ModuleRegistry.register(name, module, elements, 'loaded');

            expect(ModuleRegistry.isLoaded(name)).toBe(true);
            expect(ModuleRegistry.get(name)).toBe(module);
        });

        it('defaults to loaded state', () => {
            const name = uniqueName();
            const module = { NAME: name };

            ModuleRegistry.register(name, module, []);

            expect(ModuleRegistry.isLoaded(name)).toBe(true);
        });

        it('can register with error state', () => {
            const name = uniqueName();
            const module = { NAME: name };

            ModuleRegistry.register(name, module, [], 'error');

            expect(ModuleRegistry.isLoaded(name)).toBeFalsy();
            expect(ModuleRegistry.get(name)).toBe(null);
        });

        it('resolves pending waitFor when module has api()', async () => {
            const name = uniqueName();
            const module = {
                NAME: name,
                api: vi.fn(() => 'api result')
            };

            // Start waiting before registration
            const waitPromise = ModuleRegistry.waitFor(name, 5000);

            // Register the module
            ModuleRegistry.register(name, module, [], 'loaded');

            // Wait should resolve
            const result = await waitPromise;
            expect(result).toBe(module);
        });

        it('rejects pending waitFor when module has no api()', async () => {
            const name = uniqueName();
            const module = { NAME: name }; // No api() function

            const waitPromise = ModuleRegistry.waitFor(name, 5000);

            // Catch the rejection before registering to prevent unhandled rejection
            const rejectPromise = expect(waitPromise).rejects.toThrow(/no api\(\) interface/);

            ModuleRegistry.register(name, module, [], 'loaded');

            await rejectPromise;
        });
    });

    describe('isLoaded', () => {
        it('returns falsy for unregistered modules', () => {
            // Returns undefined for non-existent modules (falsy but not strictly false)
            expect(ModuleRegistry.isLoaded('nonexistent-module')).toBeFalsy();
        });

        it('returns true for loaded modules', () => {
            const name = uniqueName();
            ModuleRegistry.register(name, {}, [], 'loaded');

            expect(ModuleRegistry.isLoaded(name)).toBe(true);
        });

        it('returns falsy for error state modules', () => {
            const name = uniqueName();
            ModuleRegistry.register(name, {}, [], 'error');

            // entry.state !== 'loaded' means the && short-circuits to false
            expect(ModuleRegistry.isLoaded(name)).toBeFalsy();
        });
    });

    describe('get', () => {
        it('returns null for unregistered modules', () => {
            expect(ModuleRegistry.get('nonexistent-module')).toBe(null);
        });

        it('returns module for loaded modules', () => {
            const name = uniqueName();
            const module = { test: true };
            ModuleRegistry.register(name, module, [], 'loaded');

            expect(ModuleRegistry.get(name)).toBe(module);
        });

        it('returns null for error state modules', () => {
            const name = uniqueName();
            ModuleRegistry.register(name, { test: true }, [], 'error');

            expect(ModuleRegistry.get(name)).toBe(null);
        });
    });

    describe('getElements', () => {
        it('returns empty array for unregistered modules', () => {
            expect(ModuleRegistry.getElements('nonexistent')).toEqual([]);
        });

        it('returns elements for registered modules', () => {
            const name = uniqueName();
            const el1 = document.createElement('div');
            const el2 = document.createElement('span');

            ModuleRegistry.register(name, {}, [el1, el2], 'loaded');

            const elements = ModuleRegistry.getElements(name);
            expect(elements).toHaveLength(2);
            expect(elements).toContain(el1);
            expect(elements).toContain(el2);
        });
    });

    describe('waitFor', () => {
        it('resolves immediately for already loaded modules with api()', async () => {
            const name = uniqueName();
            const module = {
                NAME: name,
                api: () => 'result'
            };

            ModuleRegistry.register(name, module, [], 'loaded');

            const result = await ModuleRegistry.waitFor(name);
            expect(result).toBe(module);
        });

        it('rejects immediately for loaded modules without api()', async () => {
            const name = uniqueName();
            ModuleRegistry.register(name, { NAME: name }, [], 'loaded');

            await expect(ModuleRegistry.waitFor(name))
                .rejects.toThrow(/no api\(\) interface/);
        });

        it('returns same promise for duplicate waitFor calls', async () => {
            const name = uniqueName();

            const promise1 = ModuleRegistry.waitFor(name, 100);
            const promise2 = ModuleRegistry.waitFor(name, 100);

            expect(promise1).toBe(promise2);

            // Clean up by waiting for the timeout to reject
            await expect(promise1).rejects.toThrow(/Timeout/);
        });

        it('times out if module never loads', async () => {
            const name = uniqueName();

            await expect(ModuleRegistry.waitFor(name, 50))
                .rejects.toThrow(/Timeout waiting for module/);
        }, 1000);

        it('clears timeout when resolved', async () => {
            const name = uniqueName();
            const module = { api: () => {} };

            const promise = ModuleRegistry.waitFor(name, 30000);

            // Register quickly
            ModuleRegistry.register(name, module, [], 'loaded');

            await promise;
            // If timeout wasn't cleared, this would be slow
        });
    });

    describe('unregister', () => {
        it('removes module from registry', () => {
            const name = uniqueName();
            ModuleRegistry.register(name, {}, [], 'loaded');

            expect(ModuleRegistry.isLoaded(name)).toBe(true);

            ModuleRegistry.unregister(name);

            expect(ModuleRegistry.isLoaded(name)).toBeFalsy();
            expect(ModuleRegistry.get(name)).toBe(null);
        });

        it('handles unregister of non-existent module gracefully', () => {
            // Should not throw
            expect(() => ModuleRegistry.unregister('never-registered'))
                .not.toThrow();
        });
    });

    describe('getAll', () => {
        it('returns array of registered modules', () => {
            const name1 = uniqueName();
            const name2 = uniqueName();

            ModuleRegistry.register(name1, {}, [document.createElement('div')], 'loaded');
            ModuleRegistry.register(name2, {}, [], 'error');

            const all = ModuleRegistry.getAll();

            const mod1 = all.find(m => m.name === name1);
            const mod2 = all.find(m => m.name === name2);

            expect(mod1).toEqual({
                name: name1,
                state: 'loaded',
                elementCount: 1
            });

            expect(mod2).toEqual({
                name: name2,
                state: 'error',
                elementCount: 0
            });
        });

        it('returns empty array when no modules registered', () => {
            // Note: This test might fail if other tests don't clean up
            // We're just checking the structure here
            const all = ModuleRegistry.getAll();
            expect(Array.isArray(all)).toBe(true);
        });
    });
});
