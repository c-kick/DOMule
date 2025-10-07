export const NAME = 'debounce';

/**
 * debounceThis ES6 module v1.5 (9-2025)
 * Debounces/rate-limits the provided function (callback)
 *
 * Provides a way to debounce or rate-limit a function, which can be useful in scenarios where events may be
 * triggered frequently and rapidly, such as scrolling or resizing the window.
 *
 * Example usage:
 *
 * import {debounceThis} from "debouncer.mjs";
 *
 * window.addEventListener('scroll', debounceThis((e)=> {
 *    //function that will be debounced/rate-limited
 *    updateScrollPos('after-scroll');
 * }, {
 *    //optional parameters. Defaults:
 *   threshold: 150,   //The amount of time (in milliseconds) to wait before executing the callback function.
 *   execStart: false, //Whether to execute the callback function immediately on the first event.
 *   execWhile: false, //Whether to execute the callback function at each interval while the debouncing function is being called.
 *   execDone: true,   //Whether to execute the callback function once the debouncing function stops being called and the threshold has passed.
 * }))
 *
 * New (1.4): you can check the 'debounceType' (start, while or done) in the event supplied to the provided function
 * useful if you need to evaluate which debounce-stage triggered the function
 *
 * See demo at https://code.hnldesign.nl/demo/hnl.debounce.html
 */

const _defaults = {
  threshold: 100,
  execStart: false,
  execWhile: false,
  execDone: true,
}

export function debounceThis(callback, opts = {}) {
  // get/set options
  let options = {
    timer: 0,
    whileTimer: 0,
    busy: false,
    ..._defaults,
    ...opts,
  };

  return function (...args) {
    clearTimeout(options.timer);

    if (!options.busy && options.execStart) {
      args[0].debounceType = 'start';
      callback.apply(this, args);
      options.busy = true;
    }

    if (options.execWhile && !options.whileTimer) {
      options.whileTimer = setTimeout(() => {
        args[0].debounceType = 'while';
        callback.apply(this, args);
        options.whileTimer = false;
      }, options.threshold);
    }

    options.timer = setTimeout(() => {
      args[0].debounceType = 'done';
      options.busy = false;
      if (options.execDone) callback.apply(this, args);
      clearInterval(options.whileTimer);
    }, options.threshold);
  }
}

/**
 * debouncedEvent - (c) 2025 Klaas Leussink, MIT License
 * @version 1.1.0
 * Creates a debounced event listener for target events with flexible firing modes.
 *
 * @param {object} target - The event target to listen on (e.g., window, or an element/node)
 * @param {string} events - The comma-separated event types to listen for (e.g., 'resize, scroll', or just 'orientationchange')
 * @param {Function} callback - The function to execute when the event conditions are met
 * @param {number} [delay=100] - The delay in milliseconds for debounce/throttle timing
 * @param {boolean} [after=true] - Whether to fire the callback after the event sequence ends
 * @param {boolean} [during=false] - Whether to fire the callback continuously during the event sequence
 * @returns {Function} A cleanup function that removes the event listener and clears all timers
 *
 * @throws {Error} Throws an error if the event parameter is not a non-empty string
 *
 * @example
 * // Basic debounce: fire once after resize stops
 * const cleanup = debouncedResize('resize', () => console.log('resized'), 100);
 *
 * @example
 * // Throttle: fire immediately, then wait before allowing next fire
 * const cleanup = debouncedResize('scroll', () => console.log('scrolled'), 150, false);
 *
 * @example
 * // Continuous + final: fire during resize and once after it stops
 * const cleanup = debouncedResize('resize', updateLayout, 100, true, true);
 *
 * @example
 * // Immediate + continuous: fire at start and during resize sequence
 * const cleanup = debouncedResize('scroll', trackScroll, 50, false, true);
 *
 * @example
 * // Clean up when no longer needed
 * const cleanup = debouncedResize('orientationchange', handleOrient, 200);
 * cleanup(); // Removes listener and clears timers
 *
 * @since 1.0.0
 */
export function debouncedEvent(target, events, callback, delay = 100, after = true, during = false) {
    // Validate event parameter
    if (typeof events !== 'string' || !events.trim()) {
        throw new Error('Second parameter must be a non-empty string specifying the event type(s)');
    }

    events = events.split(',').map(s => s.trim());

    let timeoutId, intervalId, isThrottled, lastEvent = null;

    // Create wrapper for event data with debounce state
    const createEventData = (originalEvent, isFinal) => ({
        ...originalEvent,
        debounceStateFinal: isFinal,
        originalEvent // Keep reference to original if needed
    });

    const handler = (e) => {
        lastEvent = e;
        clearTimeout(timeoutId);

        if (after) {
            // Start interval for 'during' callbacks if not already running
            if (during && !intervalId) {
                intervalId = setInterval(() => {
                    callback(createEventData(lastEvent, false));
                }, delay);
            }

            // Set timeout for final callback
            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                intervalId = null;
                callback(createEventData(lastEvent, true));
            }, delay);
        } else {
            // Immediate firing mode
            if (!isThrottled) {
                callback(createEventData(lastEvent, true));
                isThrottled = true;

                if (during && !intervalId) {
                    intervalId = setInterval(() => {
                        callback(createEventData(lastEvent, false));
                    }, delay);
                }
            }

            timeoutId = setTimeout(() => {
                clearInterval(intervalId);
                intervalId = null;
                isThrottled = false;
            }, delay);
        }
    };

    // Attach listeners
    events.forEach(event => {
        target.addEventListener(event, handler, {passive: true});
    });

    // Return cleanup function
    return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        events.forEach(event => {
            target.removeEventListener(event, handler);
        });
    };
}