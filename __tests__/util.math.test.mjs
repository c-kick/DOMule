/**
 * @fileoverview Tests for util.math.mjs
 */

import { describe, it, expect } from 'vitest';
import { toMS, cubicBezier, getRandomInt, NAME } from '../util.math.mjs';

describe('util.math', () => {
    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('math');
        });
    });

    describe('toMS', () => {
        it('converts seconds to milliseconds', () => {
            expect(toMS('1s')).toBe(1000);
            expect(toMS('2s')).toBe(2000);
            expect(toMS('0.5s')).toBe(500);
            expect(toMS('1.5s')).toBe(1500);
            expect(toMS('0.25s')).toBe(250);
        });

        it('passes through milliseconds unchanged', () => {
            expect(toMS('500ms')).toBe(500);
            expect(toMS('1000ms')).toBe(1000);
            expect(toMS('100ms')).toBe(100);
        });

        it('handles decimal values', () => {
            expect(toMS('0.1s')).toBe(100);
            expect(toMS('0.01s')).toBe(10);
            expect(toMS('2.5s')).toBe(2500);
        });

        it('handles edge cases', () => {
            expect(toMS('0s')).toBe(0);
            expect(toMS('0ms')).toBe(0);
        });
    });

    describe('cubicBezier', () => {
        it('returns 0 at t=0', () => {
            const easeInOut = [0.42, 0, 0.58, 1];
            expect(cubicBezier(easeInOut, 0)).toBeCloseTo(0, 5);
        });

        it('returns 1 at t=1', () => {
            const easeInOut = [0.42, 0, 0.58, 1];
            expect(cubicBezier(easeInOut, 1)).toBeCloseTo(1, 5);
        });

        it('calculates linear curve correctly', () => {
            // Linear: [0, 0, 1, 1] - output should equal input
            const linear = [0, 0, 1, 1];
            expect(cubicBezier(linear, 0.25)).toBeCloseTo(0.25, 2);
            expect(cubicBezier(linear, 0.5)).toBeCloseTo(0.5, 2);
            expect(cubicBezier(linear, 0.75)).toBeCloseTo(0.75, 2);
        });

        it('calculates ease-in-out curve', () => {
            // Ease-in-out should be slower at edges, faster in middle
            const easeInOut = [0.42, 0, 0.58, 1];
            const midpoint = cubicBezier(easeInOut, 0.5);
            expect(midpoint).toBeCloseTo(0.5, 1);
        });

        it('calculates ease-out curve (fast start, slow end)', () => {
            const easeOut = [0, 0, 0.58, 1];
            // At t=0.25, ease-out should be ahead of linear
            const result = cubicBezier(easeOut, 0.25);
            expect(result).toBeGreaterThan(0.25);
        });

        it('calculates ease-in curve (slow start, fast end)', () => {
            const easeIn = [0.42, 0, 1, 1];
            // At t=0.25, ease-in should be behind linear
            const result = cubicBezier(easeIn, 0.25);
            expect(result).toBeLessThan(0.25);
        });
    });

    describe('getRandomInt', () => {
        it('returns integer within range', () => {
            for (let i = 0; i < 100; i++) {
                const result = getRandomInt(1, 10);
                expect(result).toBeGreaterThanOrEqual(1);
                expect(result).toBeLessThanOrEqual(10);
                expect(Number.isInteger(result)).toBe(true);
            }
        });

        it('handles single value range', () => {
            expect(getRandomInt(5, 5)).toBe(5);
        });

        it('handles negative ranges', () => {
            for (let i = 0; i < 50; i++) {
                const result = getRandomInt(-10, -5);
                expect(result).toBeGreaterThanOrEqual(-10);
                expect(result).toBeLessThanOrEqual(-5);
            }
        });

        it('handles ranges crossing zero', () => {
            for (let i = 0; i < 50; i++) {
                const result = getRandomInt(-5, 5);
                expect(result).toBeGreaterThanOrEqual(-5);
                expect(result).toBeLessThanOrEqual(5);
            }
        });

        it('handles decimal inputs by flooring/ceiling', () => {
            // getRandomInt(1.2, 3.8) should produce 2 or 3
            for (let i = 0; i < 50; i++) {
                const result = getRandomInt(1.2, 3.8);
                expect(result).toBeGreaterThanOrEqual(2);
                expect(result).toBeLessThanOrEqual(3);
            }
        });

        it('includes both min and max in possible outputs', () => {
            const results = new Set();
            for (let i = 0; i < 1000; i++) {
                results.add(getRandomInt(1, 3));
            }
            // With 1000 iterations, we should hit all values 1, 2, 3
            expect(results.has(1)).toBe(true);
            expect(results.has(2)).toBe(true);
            expect(results.has(3)).toBe(true);
        });
    });
});
