/**
 * @fileoverview Debounce Utilities - Rate-limiting for frequent events
 * @module util.debounce
 * @version 2.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides debouncing and throttling utilities for managing high-frequency events.
 * Supports start/during/end execution phases, cleanup functions, and debug integration.
 *
 * Features:
 * - Function wrapper debouncing via debounceThis()
 * - Direct event listener debouncing via debouncedEvent()
 * - Phase control (start/during/end execution)
 * - Cleanup functions for memory management
 * - Debug mode integration with logging
 *
 * @example
 * import {debounceThis, debouncedEvent} from './util.debounce.mjs';
 *
 * // Wrap function
 * const debouncedFn = debounceThis(handleResize, {threshold: 150});
 * window.addEventListener('resize', debouncedFn);
 *
 * // Direct listener with cleanup
 * const cleanup = debouncedEvent(window, 'scroll', handleScroll, {
 *   delay: 100,
 *   after: true,
 *   during: true
 * });
 * // Later: cleanup();
 */

import {logger, DEBUG} from './core.log.mjs';

export const NAME = 'debounce';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default debounce configuration
 * @private
 * @const {Object}
 */
const DEFAULT_CONFIG = {
    threshold: 100,
    execStart: false,
    execWhile: false,
    execDone: true
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates callback is a function
 * @private
 * @param {*} callback - Value to validate
 * @throws {TypeError} If callback is not a function
 */
function validateCallback(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('Callback must be a function');
    }
}

/**
 * Validates event string parameter
 * @private
 * @param {*} events - Value to validate
 * @throws {TypeError} If events is not a non-empty string
 */
function validateEvents(events) {
    if (typeof events !== 'string' || !events.trim()) {
        throw new TypeError('Events parameter must be a non-empty string');
    }
}

/**
 * Validates target has addEventListener method
 * @private
 * @param {*} target - Value to validate
 * @throws {TypeError} If target doesn't support addEventListener
 */
function validateTarget(target) {
    if (!target || typeof target.addEventListener !== 'function') {
        throw new TypeError('Target must support addEventListener');
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Wraps a function with debounce/throttle behavior.
 *
 * Creates a debounced wrapper that controls when the callback executes relative
 * to event timing. Supports execution at start, during (throttled), and end phases.
 * Event objects receive a `debounceType` property indicating execution phase.
 *
 * @param {Function} callback - Function to debounce
 * @param {Object} [options] - Debounce configuration
 * @param {number} [options.threshold=100] - Wait time in milliseconds
 * @param {boolean} [options.execStart=false] - Execute on first event
 * @param {boolean} [options.execWhile=false] - Execute during event sequence (throttled)
 * @param {boolean} [options.execDone=true] - Execute after events stop
 * @returns {Function} Debounced wrapper function
 *
 * @throws {TypeError} If callback is not a function
 *
 * @example
 * // Basic debounce (fires after 150ms of inactivity)
 * const debouncedResize = debounceThis(() => {
 *   console.log('Window resized');
 * }, {threshold: 150});
 * window.addEventListener('resize', debouncedResize);
 *
 * @example
 * // Throttle (fires immediately, then waits)
 * const throttledScroll = debounceThis((e) => {
 *   console.log('Scroll position:', window.scrollY);
 * }, {
 *   threshold: 100,
 *   execStart: true,
 *   execDone: false
 * });
 * window.addEventListener('scroll', throttledScroll);
 *
 * @example
 * // All phases (start + throttle + end)
 * const allPhases = debounceThis((e) => {
 *   console.log('Phase:', e.debounceType); // 'start', 'while', or 'done'
 * }, {
 *   threshold: 200,
 *   execStart: true,
 *   execWhile: true,
 *   execDone: true
 * });
 * window.addEventListener('input', allPhases);
 */
export function debounceThis(callback, options = {}) {
    validateCallback(callback);

    const config = {
        ...DEFAULT_CONFIG,
        ...options,
        // Internal state
        timer: 0,
        whileTimer: 0,
        busy: false
    };

    return function debounced(...args) {
        clearTimeout(config.timer);

        // Start phase: first event in sequence
        if (!config.busy && config.execStart) {
            if (args[0]) args[0].debounceType = 'start';
            callback.apply(this, args);
            config.busy = true;
        }

        // While phase: throttled execution during sequence
        if (config.execWhile && !config.whileTimer) {
            config.whileTimer = setTimeout(() => {
                if (args[0]) args[0].debounceType = 'while';
                callback.apply(this, args);
                config.whileTimer = 0;
            }, config.threshold);
        }

        // Done phase: after sequence ends
        config.timer = setTimeout(() => {
            if (args[0]) args[0].debounceType = 'done';
            config.busy = false;
            if (config.execDone) callback.apply(this, args);
            clearTimeout(config.whileTimer);
            config.whileTimer = 0;
        }, config.threshold);
    };
}

/**
 * Creates debounced event listener with automatic cleanup.
 *
 * Attaches listener directly to target with debounce/throttle behavior.
 * Returns cleanup function that removes listeners and clears timers.
 * Event objects include `debounceStateFinal` boolean indicating final execution.
 *
 * @param {EventTarget} target - Element or window to attach listener
 * @param {string} events - Comma-separated event names ('resize, scroll')
 * @param {Function} callback - Function to execute
 * @param {Object|number} [options] - Configuration or delay (backward compat)
 * @param {number} [options.delay=100] - Debounce delay in milliseconds
 * @param {boolean} [options.after=true] - Fire after event sequence ends
 * @param {boolean} [options.during=false] - Fire continuously during sequence
 * @returns {Function} Cleanup function that removes listeners and clears timers
 *
 * @throws {TypeError} If target, events, or callback are invalid
 *
 * @example
 * // Basic debounce (fires after scroll stops)
 * const cleanup = debouncedEvent(window, 'scroll', () => {
 *   console.log('Scroll stopped');
 * });
 * // Later: cleanup();
 *
 * @example
 * // Multiple events
 * const cleanup = debouncedEvent(window, 'resize, orientationchange', () => {
 *   recalculateLayout();
 * }, {delay: 150});
 *
 * @example
 * // Throttle (fires during + after)
 * const cleanup = debouncedEvent(document, 'mousemove', (e) => {
 *   if (e.debounceStateFinal) {
 *     console.log('Movement stopped');
 *   } else {
 *     console.log('Still moving...');
 *   }
 * }, {
 *   delay: 50,
 *   after: true,
 *   during: true
 * });
 *
 * @example
 * // Immediate execution only (throttle pattern)
 * const cleanup = debouncedEvent(window, 'scroll', () => {
 *   updateScrollIndicator();
 * }, {
 *   delay: 100,
 *   after: false,
 *   during: false
 * });
 */
export function debouncedEvent(target, events, callback, options, ...legacyParams) {
    // Input validation
    validateTarget(target);
    validateEvents(events);
    validateCallback(callback);

    // Backward compatibility: convert old signature (delay, after, during) to options object
    let config;
    if (typeof options === 'number' || legacyParams.length > 0) {
        if (DEBUG) {
            logger.warn(NAME,
                'debouncedEvent(target, events, callback, delay, after, during) signature is deprecated. ' +
                'Use debouncedEvent(target, events, callback, {delay, after, during}) instead.'
            );
        }
        config = {
            delay: typeof options === 'number' ? options : 100,
            after: legacyParams[0] !== undefined ? legacyParams[0] : true,
            during: legacyParams[1] !== undefined ? legacyParams[1] : false
        };
    } else {
        config = {
            delay: 100,
            after: true,
            during: false,
            ...options
        };
    }

    // Parse comma-separated events
    const eventList = events.split(',').map(e => e.trim()).filter(Boolean);

    // Internal state
    let timeoutId = 0;
    let intervalId = 0;
    let isThrottled = false;
    let lastEvent = null;

    /**
     * Creates event wrapper with debounce metadata
     * @private
     */
    const createEventData = (originalEvent, isFinal) => ({
        ...originalEvent,
        debounceStateFinal: isFinal,
        originalEvent
    });

    /**
     * Event handler with debounce logic
     * @private
     */
    const handler = (e) => {
        lastEvent = e;
        clearTimeout(timeoutId);

        if (config.after) {
            // Start interval for 'during' callbacks
            if (config.during && !intervalId) {
                intervalId = setInterval(() => {
                    callback(createEventData(lastEvent, false));
                }, config.delay);
            }

            // Schedule final callback
            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                intervalId = 0;
                callback(createEventData(lastEvent, true));
            }, config.delay);

        } else {
            // Immediate firing mode (throttle)
            if (!isThrottled) {
                callback(createEventData(lastEvent, true));
                isThrottled = true;

                if (config.during && !intervalId) {
                    intervalId = setInterval(() => {
                        callback(createEventData(lastEvent, false));
                    }, config.delay);
                }
            }

            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                intervalId = 0;
                isThrottled = false;
            }, config.delay);
        }
    };

    // Attach listeners
    const listenerOptions = {passive: true};
    eventList.forEach(event => {
        target.addEventListener(event, handler, listenerOptions);
    });

    // Return cleanup function
    return function cleanup() {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        eventList.forEach(event => {
            target.removeEventListener(event, handler, listenerOptions);
        });
    };
}