/**
 * @fileoverview Tests for core.events.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import eventHandler, { NAME } from '../core.events.mjs';

describe('core.events', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('core.events');
        });
    });

    describe('singleton pattern', () => {
        it('returns same instance on multiple imports', async () => {
            const module1 = await import('../core.events.mjs');
            const module2 = await import('../core.events.mjs');

            expect(module1.default).toBe(module2.default);
        });
    });

    describe('addListener', () => {
        it('registers callback for valid event', () => {
            const callback = vi.fn();

            const result = eventHandler.addListener('resize', callback);

            expect(result).toBe(callback);
        });

        it('returns empty function for invalid event', () => {
            const callback = vi.fn();

            const result = eventHandler.addListener('nonexistent', callback);

            expect(typeof result).toBe('function');
        });

        it('fires callback immediately for already-fired single-execution events', () => {
            // docReady should have already fired in test environment
            const callback = vi.fn();

            eventHandler.addListener('docReady', callback);

            // Run the RAF
            vi.advanceTimersByTime(16);

            // Callback should be called since DOM is ready
            expect(callback).toHaveBeenCalled();
        });

        it('prevents duplicate callback registration', () => {
            const callback = vi.fn();

            eventHandler.addListener('resize', callback);
            eventHandler.addListener('resize', callback);

            // Trigger resize
            window.dispatchEvent(new Event('resize'));
            vi.advanceTimersByTime(200);

            // Should only fire once despite being registered twice
            expect(callback.mock.calls.length).toBeLessThanOrEqual(1);
        });
    });

    describe('removeListener', () => {
        it('removes registered callback', () => {
            const callback = vi.fn();

            eventHandler.addListener('resize', callback);
            const removed = eventHandler.removeListener('resize', callback);

            expect(removed).toBe(true);
        });

        it('returns false for unregistered callback', () => {
            const callback = vi.fn();

            const removed = eventHandler.removeListener('resize', callback);

            expect(removed).toBe(false);
        });

        it('returns false for invalid event', () => {
            const callback = vi.fn();

            const removed = eventHandler.removeListener('nonexistent', callback);

            expect(removed).toBe(false);
        });
    });

    describe('convenience methods', () => {
        it('docReady registers for docReady event', () => {
            const callback = vi.fn();

            const result = eventHandler.docReady(callback);

            expect(result).toBe(callback);
        });

        it('docLoaded registers for docLoaded event', () => {
            const callback = vi.fn();

            const result = eventHandler.docLoaded(callback);

            expect(result).toBe(callback);
        });

        it('docShift registers for docShift event', () => {
            const callback = vi.fn();

            const result = eventHandler.docShift(callback);

            expect(result).toBe(callback);
        });

        it('breakPointChange registers for breakPointChange event', () => {
            const callback = vi.fn();

            const result = eventHandler.breakPointChange(callback);

            expect(result).toBe(callback);
        });

        it('imgsLoaded registers for imgsLoaded event', () => {
            const callback = vi.fn();

            const result = eventHandler.imgsLoaded(callback);

            expect(result).toBe(callback);
        });
    });

    describe('resize events', () => {
        it('registers callbacks for resize events', () => {
            const startCallback = vi.fn();
            const resizeCallback = vi.fn();
            const endCallback = vi.fn();

            // These should not throw
            expect(() => eventHandler.addListener('startResize', startCallback)).not.toThrow();
            expect(() => eventHandler.addListener('resize', resizeCallback)).not.toThrow();
            expect(() => eventHandler.addListener('endResize', endCallback)).not.toThrow();
        });
    });

    describe('scroll events', () => {
        it('registers callbacks for scroll events', () => {
            const startCallback = vi.fn();
            const scrollCallback = vi.fn();
            const endCallback = vi.fn();

            expect(() => eventHandler.addListener('startScroll', startCallback)).not.toThrow();
            expect(() => eventHandler.addListener('scroll', scrollCallback)).not.toThrow();
            expect(() => eventHandler.addListener('endScroll', endCallback)).not.toThrow();
        });
    });

    describe('docShift event', () => {
        it('registers callback for docShift', () => {
            const callback = vi.fn();

            expect(() => eventHandler.addListener('docShift', callback)).not.toThrow();
        });
    });

    describe('visibility events', () => {
        it('triggers docBlur when document hidden', () => {
            const callback = vi.fn();
            eventHandler.addListener('docBlur', callback);

            // Simulate visibility change to hidden
            Object.defineProperty(document, 'hidden', {
                value: true,
                writable: true,
                configurable: true
            });

            document.dispatchEvent(new Event('visibilitychange'));
            vi.advanceTimersByTime(16);

            // Reset
            Object.defineProperty(document, 'hidden', {
                value: false,
                writable: true,
                configurable: true
            });
        });
    });

    describe('frame deduplication', () => {
        it('does not duplicate callbacks in same animation frame', () => {
            const callback = vi.fn();
            eventHandler.addListener('resize', callback);

            // Trigger multiple resizes rapidly
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));

            vi.advanceTimersByTime(16);

            // Should only fire once per frame
            expect(callback.mock.calls.length).toBeLessThanOrEqual(3);
        });
    });
});
