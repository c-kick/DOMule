/**
 * @fileoverview Tests for util.debounce.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounceThis, debouncedEvent, NAME } from '../util.debounce.mjs';

describe('util.debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('debounce');
        });
    });

    describe('debounceThis', () => {
        it('calls function after threshold when execDone is true', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, { threshold: 100, execDone: true });

            debounced();
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(99);
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(2);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('executes immediately when execStart is true', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, {
                threshold: 100,
                execStart: true,
                execDone: false
            });

            debounced();
            expect(callback).toHaveBeenCalledTimes(1);

            // Subsequent calls within threshold should not trigger
            debounced();
            debounced();
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('throttles during sequence when execWhile is true', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, {
                threshold: 100,
                execStart: false,
                execWhile: true,
                execDone: false
            });

            debounced();
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(1);

            // Continuous calls
            debounced();
            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('resets busy state after threshold', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, {
                threshold: 100,
                execStart: true,
                execDone: true
            });

            // First call - executes immediately
            debounced();
            expect(callback).toHaveBeenCalledTimes(1);

            // Wait for done phase
            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(2); // execDone also fired

            // New sequence should execute immediately again
            debounced();
            expect(callback).toHaveBeenCalledTimes(3);
        });

        it('adds debounceType to event object', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, {
                threshold: 100,
                execStart: true,
                execDone: true
            });

            const event = { type: 'test' };
            debounced(event);

            expect(callback).toHaveBeenCalledWith(event);
            expect(event.debounceType).toBe('start');

            vi.advanceTimersByTime(100);
            expect(event.debounceType).toBe('done');
        });

        it('uses default config when no options provided', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback);

            debounced();
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('throws TypeError for non-function callback', () => {
            expect(() => debounceThis('not a function')).toThrow(TypeError);
            expect(() => debounceThis(null)).toThrow(TypeError);
            expect(() => debounceThis(123)).toThrow(TypeError);
        });

        it('preserves this context', () => {
            const context = { name: 'test' };
            let capturedThis;

            const debounced = debounceThis(function() {
                capturedThis = this;
            }, { threshold: 100, execDone: true });

            debounced.call(context);
            vi.advanceTimersByTime(100);

            expect(capturedThis).toBe(context);
        });

        it('cancels pending done when new event arrives', () => {
            const callback = vi.fn();
            const debounced = debounceThis(callback, { threshold: 100, execDone: true });

            debounced();
            vi.advanceTimersByTime(50);
            debounced(); // Reset timer
            vi.advanceTimersByTime(50);

            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('debouncedEvent', () => {
        let target;
        let cleanup;

        beforeEach(() => {
            target = document.createElement('div');
            cleanup = null;
        });

        afterEach(() => {
            if (cleanup) cleanup();
        });

        it('fires callback after event stops', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click', callback, { delay: 100 });

            target.dispatchEvent(new Event('click'));
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('includes debounceStateFinal in event data', () => {
            let eventData;
            cleanup = debouncedEvent(target, 'click', (e) => {
                eventData = e;
            }, { delay: 100, after: true });

            target.dispatchEvent(new Event('click'));
            vi.advanceTimersByTime(100);

            expect(eventData.debounceStateFinal).toBe(true);
        });

        it('handles multiple event types', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click, mouseenter', callback, { delay: 100 });

            target.dispatchEvent(new Event('click'));
            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(1);

            target.dispatchEvent(new Event('mouseenter'));
            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it('returns cleanup function that removes listeners', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click', callback, { delay: 100 });

            cleanup();
            cleanup = null;

            target.dispatchEvent(new Event('click'));
            vi.advanceTimersByTime(100);

            expect(callback).not.toHaveBeenCalled();
        });

        it('fires during sequence when during is true', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click', callback, {
                delay: 50,
                after: true,
                during: true
            });

            target.dispatchEvent(new Event('click'));

            // Should fire during callbacks at intervals
            vi.advanceTimersByTime(50);
            expect(callback).toHaveBeenCalled();
        });

        it('throws TypeError for invalid target', () => {
            expect(() => debouncedEvent(null, 'click', () => {}))
                .toThrow(TypeError);
            expect(() => debouncedEvent('string', 'click', () => {}))
                .toThrow(TypeError);
        });

        it('throws TypeError for invalid events', () => {
            expect(() => debouncedEvent(target, '', () => {}))
                .toThrow(TypeError);
            expect(() => debouncedEvent(target, null, () => {}))
                .toThrow(TypeError);
        });

        it('throws TypeError for invalid callback', () => {
            expect(() => debouncedEvent(target, 'click', 'not a function'))
                .toThrow(TypeError);
            expect(() => debouncedEvent(target, 'click', null))
                .toThrow(TypeError);
        });

        it('accepts numeric delay for backward compatibility', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click', callback, 200);

            target.dispatchEvent(new Event('click'));
            vi.advanceTimersByTime(199);
            expect(callback).not.toHaveBeenCalled();

            vi.advanceTimersByTime(2);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('clears timers on cleanup', () => {
            const callback = vi.fn();
            cleanup = debouncedEvent(target, 'click', callback, {
                delay: 100,
                during: true
            });

            target.dispatchEvent(new Event('click'));

            // Cleanup before timer fires
            cleanup();
            cleanup = null;

            vi.advanceTimersByTime(200);
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
