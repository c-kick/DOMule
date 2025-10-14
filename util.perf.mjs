/**
 * @fileoverview Performance Utilities - FPS tracking, scroll snap detection, easing
 * @module util.perf
 * @version 1.1.0
 * @author hnldesign
 * @since 2022
 */

export const NAME = 'perf';

/**
 * Timeout threshold for scroll stop detection.
 * @private
 * @constant {number}
 */
const SCROLL_STOP_TIMEOUT = 150;

/**
 * FPS calculation window in milliseconds.
 * @private
 * @constant {number}
 */
const FPS_WINDOW = 1000;

/**
 * Adds scroll snap detection to an element.
 * Dispatches scrollSnapped, scrollStopped, and scrollStoppedSnapped events.
 *
 * Requires data-scroll-direction="horizontal|vertical" on element.
 *
 * @param {HTMLElement} element - Snap-scrolling element
 * @param {Object} [options={}] - Configuration options
 * @param {Function} [options.onSnap] - Callback when snapping occurs
 * @param {Function} [options.onStop] - Callback when scrolling stops
 * @param {number} [options.stopTimeout=150] - Timeout for stop detection (ms)
 *
 * @example
 * const scroller = document.querySelector('.snap-scroller');
 * snapScrollComplete(scroller, {
 *   onSnap: () => console.log('Snapped to position'),
 *   onStop: () => console.log('Scroll stopped'),
 *   stopTimeout: 200
 * });
 */
export function snapScrollComplete(element, options = {}) {
    const {
        onSnap = null,
        onStop = null,
        stopTimeout = SCROLL_STOP_TIMEOUT
    } = options;

    if (!element.dataset.scrollDirection) {
        console.warn('snapScrollComplete: element requires data-scroll-direction attribute');
        return;
    }

    const isHorizontal = element.dataset.scrollDirection === 'horizontal';
    let timeout = null;

    const handler = (e) => {
        const scrollPos = isHorizontal ? e.target.scrollLeft : e.target.scrollTop;
        const dimension = isHorizontal ? e.target.offsetWidth : e.target.offsetHeight;
        const atSnappingPoint = scrollPos % dimension === 0;
        const delay = atSnappingPoint ? 0 : stopTimeout;

        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (!delay) {
                e.target.dispatchEvent(new Event('scrollSnapped'));
                if (typeof onSnap === 'function') onSnap.call(element);
            } else {
                e.target.dispatchEvent(new Event('scrollStopped'));
                if (typeof onStop === 'function') onStop.call(element);
            }
            e.target.dispatchEvent(new Event('scrollStoppedSnapped'));
        }, delay);
    };

    element.addEventListener('scroll', handler, {passive: true});

    // Return cleanup function
    return () => {
        clearTimeout(timeout);
        element.removeEventListener('scroll', handler);
    };
}

/**
 * FPS (frames per second) counter with event dispatching.
 * Measures real-time FPS and dispatches fpsUpdate events.
 *
 * @class
 *
 * @example
 * const fpsCounter = new FpsCounter((fps) => {
 *   console.log(`Current FPS: ${fps}`);
 * });
 *
 * // Later, stop tracking
 * fpsCounter.stop();
 *
 * @example
 * // Listen to events instead of callback
 * const counter = new FpsCounter();
 * window.addEventListener('fpsUpdate', (e) => {
 *   console.log('FPS:', e.detail.fps);
 * });
 */
export class FpsCounter {
    /**
     * Creates FPS counter instance.
     *
     * @param {Function} [callback] - Called on each FPS update with current FPS value
     */
    constructor(callback) {
        this.timeStamps = [performance.now()];
        this.fpsEvent = new CustomEvent('fpsUpdate', {detail: this, bubbles: true, cancelable: true});
        this.callback = typeof callback === 'function' ? callback : null;
        this.fps = 60; // Default assumption
        this.requestId = null;
        this.fpsTimer = this.fpsTimer.bind(this);
        this.start();
    }

    /**
     * Internal timer for FPS calculation.
     * @private
     * @param {DOMHighResTimeStamp} now - Current timestamp
     */
    fpsTimer(now) {
        // Keep only timestamps within last second
        this.timeStamps = this.timeStamps.filter((time) => (now - time) <= FPS_WINDOW);

        // Calculate real-time FPS
        const len = this.timeStamps.length;
        this.realFPS = len > 1 ? (1000 / (now - this.timeStamps[len - 1])) : this.fps;

        // Add current timestamp
        this.timeStamps.push(now);

        // Average bucket count with real FPS (smooths out frame drops)
        this.fps = Math.round((this.timeStamps.length + this.realFPS) / 2);

        // Dispatch event
        window.dispatchEvent(this.fpsEvent);

        // Execute callback
        if (this.callback) {
            this.callback.call(this, this.fps);
        }

        // Continue loop
        this.requestId = requestAnimationFrame(this.fpsTimer);
    }

    /**
     * Starts FPS counter.
     * @public
     */
    start() {
        if (!this.requestId) {
            this.requestId = requestAnimationFrame(this.fpsTimer);
        }
    }

    /**
     * Stops FPS counter and cleans up resources.
     * @public
     */
    stop() {
        if (this.requestId) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    }
}

/**
 * Calculates eased mean values for smoothing data streams.
 * Maintains separate histories per type for multiple concurrent streams.
 *
 * @class
 *
 * @example
 * const easer = new EasedMeanCalculator();
 *
 * // Smooth scroll speed over 5 frames
 * const smoothSpeed = easer.getValue(currentSpeed, 'speed', 5);
 *
 * // Smooth FPS over 3 frames
 * const smoothFps = easer.getValue(currentFps, 'fps', 3);
 *
 * // Reset specific stream
 * easer.reset('speed');
 */
export class EasedMeanCalculator {
    /**
     * Creates easing calculator instance.
     */
    constructor() {
        this.history = {};
    }

    /**
     * Gets eased mean value for a data stream.
     *
     * @param {number} value - Current value to add to history
     * @param {string} [type='default'] - Stream identifier
     * @param {number} [range=3] - Number of values to average
     * @returns {number} Eased mean value
     */
    getValue(value, type = 'default', range = 3) {
        // Initialize history for type
        if (!this.history[type]) {
            this.history[type] = [];
        }

        // Add current value
        this.history[type].push(value);

        // Use only last N values
        const recent = this.history[type].slice(-range);

        // Calculate mean
        return recent.reduce((sum, val) => sum + val, 0) / recent.length;
    }

    /**
     * Resets history for a specific stream.
     *
     * @param {string} type - Stream identifier to reset
     */
    reset(type) {
        this.history[type] = [];
    }
}

/**
 * Calculates scroll percentage of webpage.
 *
 * @returns {number} Scroll percentage (0-100)
 *
 * @example
 * window.addEventListener('scroll', () => {
 *   const pct = pageScrollPercentage();
 *   console.log(`Scrolled ${pct.toFixed(1)}%`);
 * });
 */
export function pageScrollPercentage() {
    const scrollPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

    // Document smaller than viewport
    if (totalHeight <= 0) {
        return 100;
    }

    // Clamp to 0-100
    return Math.min(100, Math.max(0, (scrollPos / totalHeight) * 100));
}