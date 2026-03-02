/**
 * @fileoverview Tests for util.iteration.mjs
 */

import { describe, it, expect, vi } from 'vitest';
import { objForEach, forEachBatched, NAME } from '../util.iteration.mjs';

describe('util.iteration', () => {
    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('iteration');
        });
    });

    describe('objForEach', () => {
        it('iterates over object properties', () => {
            const obj = { a: 1, b: 2, c: 3 };
            const results = [];

            objForEach(obj, (key, value, index) => {
                results.push({ key, value, index });
            });

            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({ key: 'a', value: 1, index: 0 });
            expect(results[1]).toEqual({ key: 'b', value: 2, index: 1 });
            expect(results[2]).toEqual({ key: 'c', value: 3, index: 2 });
        });

        it('calls done callback after iteration', () => {
            const obj = { a: 1, b: 2 };
            const doneFn = vi.fn();

            objForEach(obj, () => {}, doneFn);

            expect(doneFn).toHaveBeenCalledTimes(1);
        });

        it('passes object as fourth argument to callback', () => {
            const obj = { a: 1 };
            let passedObj;

            objForEach(obj, (key, value, index, o) => {
                passedObj = o;
            });

            expect(passedObj).toBe(obj);
        });

        it('respects thisArg', () => {
            const obj = { a: 1 };
            const context = { name: 'test' };
            let callbackThis;
            let doneThis;

            objForEach(
                obj,
                function() { callbackThis = this; },
                function() { doneThis = this; },
                context
            );

            expect(callbackThis).toBe(context);
            expect(doneThis).toBe(context);
        });

        it('only iterates own properties (not inherited)', () => {
            const parent = { inherited: true };
            const obj = Object.create(parent);
            obj.own = true;

            const keys = [];
            objForEach(obj, (key) => keys.push(key));

            expect(keys).toEqual(['own']);
            expect(keys).not.toContain('inherited');
        });

        it('handles empty objects', () => {
            const obj = {};
            const callback = vi.fn();
            const doneFn = vi.fn();

            objForEach(obj, callback, doneFn);

            expect(callback).not.toHaveBeenCalled();
            expect(doneFn).toHaveBeenCalledTimes(1);
        });

        it('throws TypeError for null', () => {
            expect(() => objForEach(null, () => {}))
                .toThrow(TypeError);
        });

        it('throws TypeError for non-object', () => {
            expect(() => objForEach('string', () => {}))
                .toThrow(TypeError);
            expect(() => objForEach(123, () => {}))
                .toThrow(TypeError);
        });

        it('works without done callback', () => {
            const obj = { a: 1 };
            const callback = vi.fn();

            // Should not throw
            expect(() => objForEach(obj, callback)).not.toThrow();
            expect(callback).toHaveBeenCalled();
        });
    });

    describe('forEachBatched', () => {
        it('iterates over all properties', async () => {
            const obj = { a: 1, b: 2, c: 3 };
            const results = [];

            await new Promise((resolve) => {
                forEachBatched(
                    obj,
                    (value, key) => results.push({ key, value }),
                    () => resolve(),
                    10
                );
            });

            expect(results).toHaveLength(3);
            expect(results.map(r => r.key)).toContain('a');
            expect(results.map(r => r.key)).toContain('b');
            expect(results.map(r => r.key)).toContain('c');
        });

        it('processes in batches', async () => {
            const obj = {};
            for (let i = 0; i < 10; i++) {
                obj[`key${i}`] = i;
            }

            let callCount = 0;

            await new Promise((resolve) => {
                forEachBatched(
                    obj,
                    () => callCount++,
                    () => resolve(),
                    3 // Batch size of 3
                );
            });

            expect(callCount).toBe(10);
        });

        it('calls done callback with last key/value', async () => {
            const obj = { a: 1, b: 2, c: 3 };
            let doneArgs;

            await new Promise((resolve) => {
                forEachBatched(
                    obj,
                    () => {},
                    (lastValue, lastKey, o) => {
                        doneArgs = { lastValue, lastKey, obj: o };
                        resolve();
                    },
                    10
                );
            });

            expect(doneArgs.lastKey).toBe('c');
            expect(doneArgs.lastValue).toBe(3);
            expect(doneArgs.obj).toBe(obj);
        });

        it('throws TypeError for null/undefined', () => {
            expect(() => forEachBatched(null, () => {}, () => {}))
                .toThrow(TypeError);
            expect(() => forEachBatched(undefined, () => {}, () => {}))
                .toThrow(TypeError);
        });

        it('throws TypeError if callbacks not functions', () => {
            expect(() => forEachBatched({}, 'notfn', () => {}))
                .toThrow(TypeError);
            expect(() => forEachBatched({}, () => {}, 'notfn'))
                .toThrow(TypeError);
        });

        it('handles empty objects', async () => {
            const obj = {};
            const callback = vi.fn();

            await new Promise((resolve) => {
                forEachBatched(obj, callback, resolve, 10);
            });

            expect(callback).not.toHaveBeenCalled();
        });

        it('uses default batch size when not specified', async () => {
            const obj = { a: 1 };

            await new Promise((resolve) => {
                // Should not throw when batchSize not provided
                forEachBatched(obj, () => {}, resolve);
            });
        });
    });
});
