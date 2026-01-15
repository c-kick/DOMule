/**
 * @fileoverview Tests for core.scanner.mjs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { domScanner, NAME } from '../core.scanner.mjs';
import { createRequiringElement } from './setup.mjs';

describe('core.scanner', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('core.scanner');
        });
    });

    describe('domScanner', () => {
        describe('basic scanning', () => {
            it('finds elements with data-requires', () => {
                createRequiringElement('./module-a.mjs');
                createRequiringElement('./module-b.mjs');

                const { modules, stats } = domScanner();

                expect(Object.keys(modules)).toHaveLength(2);
                expect(modules['./module-a.mjs']).toHaveLength(1);
                expect(modules['./module-b.mjs']).toHaveLength(1);
                expect(stats.immediate).toBe(2);
            });

            it('groups multiple elements requiring same module', () => {
                createRequiringElement('./shared.mjs', { id: 'el1' });
                createRequiringElement('./shared.mjs', { id: 'el2' });
                createRequiringElement('./shared.mjs', { id: 'el3' });

                const { modules } = domScanner();

                expect(modules['./shared.mjs']).toHaveLength(3);
            });

            it('returns empty objects when no elements found', () => {
                const { modules, deferred, stats } = domScanner();

                expect(modules).toEqual({});
                expect(deferred).toEqual({});
                expect(stats.total).toBe(0);
            });
        });

        describe('lazy loading detection', () => {
            it('separates lazy modules into deferred', () => {
                createRequiringElement('./immediate.mjs');
                createRequiringElement('./lazy.mjs', { lazy: true });

                const { modules, deferred, stats } = domScanner();

                expect(Object.keys(modules)).toContain('./immediate.mjs');
                expect(Object.keys(deferred)).toContain('./lazy.mjs');
                expect(stats.immediate).toBe(1);
                expect(stats.lazy).toBe(1);
            });

            it('handles data-require-lazy="true"', () => {
                createRequiringElement('./lazy.mjs', { lazy: 'true' });

                const { deferred } = domScanner();

                expect(deferred['./lazy.mjs']).toBeDefined();
            });

            it('handles data-require-lazy="strict"', () => {
                createRequiringElement('./lazy.mjs', { lazy: 'strict' });

                const { deferred } = domScanner();

                expect(deferred['./lazy.mjs']).toBeDefined();
            });

            it('handles data-require-lazy="false" as immediate', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', './module.mjs');
                el.setAttribute('data-require-lazy', 'false');
                document.body.appendChild(el);

                const { modules, deferred } = domScanner();

                expect(modules['./module.mjs']).toBeDefined();
                expect(deferred['./module.mjs']).toBeUndefined();
            });
        });

        describe('comma-separated modules', () => {
            it('splits comma-separated module paths', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', './module-a.mjs,./module-b.mjs,./module-c.mjs');
                document.body.appendChild(el);

                const { modules } = domScanner();

                expect(Object.keys(modules)).toHaveLength(3);
                expect(modules['./module-a.mjs']).toContain(el);
                expect(modules['./module-b.mjs']).toContain(el);
                expect(modules['./module-c.mjs']).toContain(el);
            });

            it('handles spaces around commas', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', './a.mjs , ./b.mjs , ./c.mjs');
                document.body.appendChild(el);

                const { modules } = domScanner();

                expect(modules['./a.mjs']).toBeDefined();
                expect(modules['./b.mjs']).toBeDefined();
                expect(modules['./c.mjs']).toBeDefined();
            });

            it('ignores empty entries from double commas', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', './a.mjs,,./b.mjs');
                document.body.appendChild(el);

                const { modules } = domScanner();

                expect(Object.keys(modules)).toHaveLength(2);
            });
        });

        describe('element state tracking', () => {
            it('initializes _moduleTracking on elements', () => {
                const el = createRequiringElement('./module.mjs');

                domScanner();

                expect(el._moduleTracking).toEqual({
                    required: 1,
                    loaded: 0
                });
            });

            it('counts multiple required modules correctly', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', './a.mjs,./b.mjs,./c.mjs');
                document.body.appendChild(el);

                domScanner();

                expect(el._moduleTracking.required).toBe(3);
            });

            it('adds module-pending class', () => {
                const el = createRequiringElement('./module.mjs');

                domScanner();

                expect(el.classList.contains('module-pending')).toBe(true);
            });

            it('sets data-requires-state to pending', () => {
                const el = createRequiringElement('./module.mjs');

                domScanner();

                expect(el.dataset.requiresState).toBe('pending');
            });
        });

        describe('callback', () => {
            it('calls callback with results', () => {
                createRequiringElement('./immediate.mjs');
                createRequiringElement('./lazy.mjs', { lazy: true });

                const callback = vi.fn();
                domScanner(callback);

                expect(callback).toHaveBeenCalledTimes(1);

                const [modules, deferred, stats] = callback.mock.calls[0];
                expect(modules['./immediate.mjs']).toBeDefined();
                expect(deferred['./lazy.mjs']).toBeDefined();
                expect(stats.immediate).toBe(1);
                expect(stats.lazy).toBe(1);
                expect(stats.total).toBe(2);
            });

            it('calls callback even with no elements', () => {
                const callback = vi.fn();
                domScanner(callback);

                expect(callback).toHaveBeenCalledWith(
                    {},
                    {},
                    { immediate: 0, lazy: 0, total: 0 }
                );
            });

            it('works without callback', () => {
                createRequiringElement('./module.mjs');

                // Should not throw
                expect(() => domScanner()).not.toThrow();
            });
        });

        describe('edge cases', () => {
            it('handles empty data-requires attribute', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', '');
                document.body.appendChild(el);

                const { modules, stats } = domScanner();

                expect(stats.total).toBe(0);
            });

            it('handles whitespace-only data-requires', () => {
                const el = document.createElement('div');
                el.setAttribute('data-requires', '   ');
                document.body.appendChild(el);

                const { modules, stats } = domScanner();

                expect(stats.total).toBe(0);
            });

            it('handles nested elements', () => {
                document.body.innerHTML = `
                    <div data-requires="./parent.mjs">
                        <div data-requires="./child.mjs">
                            <div data-requires="./grandchild.mjs"></div>
                        </div>
                    </div>
                `;

                const { modules, stats } = domScanner();

                expect(stats.immediate).toBe(3);
            });

            it('handles various HTML elements', () => {
                const div = document.createElement('div');
                div.setAttribute('data-requires', './div.mjs');
                document.body.appendChild(div);

                const span = document.createElement('span');
                span.setAttribute('data-requires', './span.mjs');
                document.body.appendChild(span);

                const section = document.createElement('section');
                section.setAttribute('data-requires', './section.mjs');
                document.body.appendChild(section);

                const { modules } = domScanner();

                expect(Object.keys(modules)).toHaveLength(3);
            });
        });

        describe('return value', () => {
            it('returns modules, deferred, and stats', () => {
                createRequiringElement('./immediate.mjs');
                createRequiringElement('./lazy.mjs', { lazy: true });

                const result = domScanner();

                expect(result).toHaveProperty('modules');
                expect(result).toHaveProperty('deferred');
                expect(result).toHaveProperty('stats');
                expect(result.stats).toHaveProperty('immediate');
                expect(result.stats).toHaveProperty('lazy');
                expect(result.stats).toHaveProperty('total');
            });
        });
    });
});
