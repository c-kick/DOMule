/**
 * @fileoverview Event Handler - Centralized event management with debounced handling
 * @module core.events
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides centralized event management system implementing singleton pattern.
 * Automatically deduplicates callbacks within same animation frame, handles
 * debounced resize/scroll with start/during/end phases, and manages single-execution
 * events that fire immediately if already occurred.
 *
 * Features:
 * - Automatic callback deduplication per animation frame
 * - Debounced resize/scroll with phase detection (start/during/end)
 * - Single-execution events (docReady, docLoaded, imgsLoaded)
 * - Automatic breakpoint detection and management
 * - Document visibility tracking (tab switching, minimize)
 * - Image and content load tracking
 * - Body resize detection with ResizeObserver
 *
 * @example
 * import events from './core.events.mjs';
 *
 * // Listen for resize
 * events.addListener('resize', (e) => {
 *   console.log('Window resized');
 * });
 *
 * // Use shorthand
 * events.docReady(() => {
 *   console.log('DOM ready');
 * });
 */

import './util.polyfills.mjs';
import {debounceThis} from './util.debounce.mjs';
import {logger} from "./core.log.mjs";

export const NAME = 'eventHandler';

/**
 * EventHandler class - Manages DOM and window events with intelligent debouncing
 * and deduplication. Automatically initializes as singleton.
 *
 * @class
 * @private
 */
class EventHandler {

    constructor() {
        // Prevent multiple instantiation
        if (EventHandler._instance) {
            return EventHandler._instance;
        }
        EventHandler._instance = this;

        /**
         * Map of event names to Sets of callback functions.
         * Using Map/Set for O(1) operations and automatic deduplication.
         * @type {Map<string, Set<Function>>}
         * @private
         */
        this._callbacks = new Map([
            ['docReady', new Set()],
            ['docLoaded', new Set()],
            ['imgsLoaded', new Set()],
            ['breakPointChange', new Set()],
            ['docShift', new Set()],
            ['startResize', new Set()],
            ['resize', new Set()],
            ['endResize', new Set()],
            ['bodyResize', new Set()],
            ['docBlur', new Set()],
            ['docFocus', new Set()],
            ['startScroll', new Set()],
            ['scroll', new Set()],
            ['endScroll', new Set()]
        ]);

        /**
         * Track last execution timestamp per callback using WeakMap.
         * When callback becomes unreachable, entry is garbage collected.
         * @type {WeakMap<Function, DOMHighResTimeStamp>}
         * @private
         */
        this._lastRunTimeStamps = new WeakMap();

        /**
         * Events allowed to fire multiple callbacks in same animation frame.
         * @type {Set<string>}
         * @private
         */
        this._allowMultiple = new Set(['breakPointChange']);

        /**
         * Events that fire only once in page lifetime.
         * @type {Set<string>}
         * @private
         */
        this._singleExecution = new Set(['docReady', 'docLoaded', 'imgsLoaded']);

        /**
         * Track which single-execution events have already fired.
         * @type {Object<string, boolean>}
         * @private
         */
        this._states = {};

        /**
         * Track event timing for performance logging.
         * @type {Object<string, DOMHighResTimeStamp>}
         * @private
         */
        this._timestamps = {};

        // Initialize all event bindings
        this._initReadyEvents();
        this._initBreakpointEvents();
        this._initResizeEvents();
        this._initScrollEvents();
        this._initVisibilityEvents();
        this._initContentEvents();
    }

    // ============================================================================
    // PRIVATE INITIALIZATION METHODS
    // ============================================================================

    /**
     * Initialize document ready and load events.
     * Checks if DOM is already ready for immediate callback execution.
     * @private
     */
    _initReadyEvents() {
        // Check if DOM is already ready
        if (document.readyState !== "loading") {
            logger.info(NAME, 'Document is ready.');
            this._runListeners(['docReady', 'docShift']);
            this._states.docReady = true;
        } else {
            window.addEventListener("DOMContentLoaded", (e) => {
                logger.info(NAME, 'Document is ready.');
                this._runListeners(['docReady', 'docShift'], e);
                this._states.docReady = true;
            });
        }

        // Full page load (including all resources)
        window.addEventListener("load", (e) => {
            logger.info(NAME, 'Page is fully loaded.');
            this._runListeners(['docLoaded'], e);
            this._states.docLoaded = true;
        });
    }

    /**
     * Initialize responsive breakpoint detection.
     * Imports breakpoint handler which dispatches breakPointChange events.
     * @private
     */
    _initBreakpointEvents() {
        document.addEventListener('breakPointChange', (e) => {
            if (e.detail.matches) {
                logger.info(NAME, 'Breakpoint matched: ' + e.detail.name);
                this._runListeners(['breakPointChange'], e);
            }
        });

        // Import breakpoint handler module (auto-initializes)
        import('./hnl.breakpoints.mjs');
    }

    /**
     * Initialize debounced window resize events.
     * Provides start/during/end phases for efficient resize handling.
     * @private
     */
    _initResizeEvents() {
        // Resize start (fires once at beginning)
        window.addEventListener('resize', debounceThis((e) => {
            logger.info(NAME, 'Resize started.');
            this._timestamps['resize'] = performance.now();
            this._runListeners(['startResize'], e);
        }, {execStart: true, execWhile: false, execDone: false}));

        // Resize during (fires continuously while resizing)
        window.addEventListener('resize', debounceThis((e) => {
            this._runListeners(['resize'], e);
        }, {execStart: true, execWhile: true, execDone: true}));

        // Resize end (fires once when resizing stops)
        window.addEventListener('resize', debounceThis((e) => {
            e.TimeTaken = performance.now() - this._timestamps['resize'];
            logger.info(NAME, 'Resize ended. (took ' + Math.round(e.TimeTaken * 10) / 10 + 'ms)');
            this._runListeners(['endResize', 'docShift'], e);
        }, {execStart: false, execWhile: false, execDone: true}));

        // Body resize observer with fallback for older browsers
        this._initBodyResize();
    }

    /**
     * Initialize body resize detection.
     * Uses ResizeObserver when available (Chrome 64+, Safari 13.1+, Firefox 69+),
     * falls back to window resize proxy for older browsers.
     * @private
     */
    _initBodyResize() {
        if (typeof ResizeObserver !== 'undefined') {
            // Modern approach: observe body element directly
            const bodyObserver = new ResizeObserver(debounceThis((e) => {
                this._runListeners(['docShift', 'bodyResize'], e);
            }, {execStart: false, execWhile: false, execDone: true, threshold: 150}));

            bodyObserver.observe(document.body);
        } else {
            // Fallback for Safari <13.1: proxy body resize via window resize
            logger.warn(NAME, 'ResizeObserver not supported, using window resize fallback for bodyResize event');

            window.addEventListener('resize', debounceThis((e) => {
                this._runListeners(['bodyResize'], e);
            }, {execStart: false, execWhile: false, execDone: true, threshold: 150}));
        }
    }

    /**
     * Initialize debounced scroll events.
     * Provides start/during/end phases with optimized thresholds (100ms for responsive feel).
     * @private
     */
    _initScrollEvents() {
        // Scroll start (fires once at beginning)
        window.addEventListener('scroll', debounceThis((e) => {
            this._timestamps['scroll'] = performance.now();
            this._runListeners(['startScroll'], e);
        }, {execStart: true, execWhile: false, execDone: false}));

        // Scroll during (fires continuously while scrolling)
        window.addEventListener('scroll', debounceThis((e) => {
            this._runListeners(['scroll', 'docShift'], e);
        }, {execStart: false, execWhile: true, execDone: false, threshold: 100}));

        // Scroll end (fires once when scrolling stops)
        window.addEventListener('scroll', debounceThis((e) => {
            e.TimeTaken = performance.now() - this._timestamps['scroll'];
            this._runListeners(['endScroll'], e);
        }, {execStart: false, execWhile: false, execDone: true}));
    }

    /**
     * Initialize document visibility change events (tab switching, minimize, window focus).
     * Handles both standard and IE/Edge prefixed visibility API.
     * @private
     */
    _initVisibilityEvents() {
        // Feature detection for visibility API
        const docHidden = (typeof document.hidden !== "undefined");
        const hidden = docHidden ? "hidden" : "msHidden";
        const visibilityChange = docHidden ? "visibilitychange" : "msvisibilitychange";

        let document_hidden = document[hidden];

        document.addEventListener(visibilityChange, (e) => {
            if (document_hidden !== document[hidden]) {
                if (document[hidden]) {
                    // Document lost focus
                    this._timestamps['visibility'] = performance.now();
                    this._runListeners(['docBlur'], e);
                } else {
                    // Document regained focus
                    e.TimeTaken = performance.now() - this._timestamps['visibility'];
                    this._runListeners(['docFocus', 'docShift'], e);
                }
                document_hidden = document[hidden];
            }
        });
    }

    /**
     * Initialize image load tracking.
     * Tracks when all non-lazy images have loaded. Counts both successful loads
     * and errors as "loaded" to prevent hang on broken images.
     * @private
     */
    _initContentEvents() {
        const images = Array.from(document.images).filter(
            img => !img.complete && img.loading !== 'lazy'
        );
        const imageCount = images.length;

        if (imageCount === 0) {
            // No images to wait for
            logger.info(NAME, 'No non-lazy images to load.');
            this._runListeners(['imgsLoaded']);
            this._states.imgsLoaded = true;
        } else {
            // Count images as they load (success or error both count as "loaded")
            let loaded = 0;
            const checkComplete = () => {
                loaded++;
                if (loaded === imageCount) {
                    const totalImages = document.images.length;
                    logger.info(NAME, `All non-lazy images loaded (${imageCount}/${totalImages} total).`);
                    this._runListeners(['imgsLoaded']);
                    this._states.imgsLoaded = true;
                }
            };

            images.forEach(img => {
                img.addEventListener('load', checkComplete, {once: true});
                img.addEventListener('error', checkComplete, {once: true});
            });
        }
    }

    // ============================================================================
    // PRIVATE CORE METHODS
    // ============================================================================

    /**
     * Execute all registered callbacks for given events.
     * Batches execution in single animation frame and prevents duplicate calls
     * within same frame (except for events in _allowMultiple set).
     *
     * @private
     * @param {string[]} events - Event names to trigger
     * @param {Event} [origEvent] - Original DOM event object to pass to callbacks
     */
    _runListeners(events, origEvent) {
        requestAnimationFrame((timeStamp) => {
            for (const event of events) {
                const cbs = this._callbacks.get(event);
                if (!cbs) continue;

                for (const cb of cbs) {
                    // Skip if already ran this frame (unless event allows multiple executions)
                    if (!this._allowMultiple.has(event)) {
                        const lastRun = this._lastRunTimeStamps.get(cb);
                        if (lastRun === timeStamp) {
                            continue; // Skip duplicate call in same frame
                        }
                    }

                    // Mark as run and execute
                    this._lastRunTimeStamps.set(cb, timeStamp);
                    cb.call(this, origEvent);
                }
            }
        });
    }

    // ============================================================================
    // PUBLIC API METHODS
    // ============================================================================

    /**
     * Register a callback for an event.
     * If event is single-execution and already occurred, callback fires immediately.
     * Prevents duplicate registration of same callback function.
     *
     * @param {string} event - Event name (docReady, resize, scroll, etc.)
     * @param {Function} callback - Function to execute when event fires
     * @returns {Function} The callback (for chaining or immediate invocation)
     *
     * @example
     * // Basic usage
     * events.addListener('resize', (e) => {
     *   console.log('Resized');
     * });
     *
     * @example
     * // Immediately invoke if already ready
     * events.addListener('docReady', () => {
     *   console.log('This fires immediately if DOM is already ready');
     * });
     *
     * @example
     * // Chain for immediate call
     * events.addListener('resize', handleResize)();
     */
    addListener(event, callback) {
        const cbs = this._callbacks.get(event);

        if (!cbs) {
            logger.warn(NAME, `No such event: ${event}`);
            return () => {};
        }

        // Fire immediately if single-execution event already occurred
        if (this._singleExecution.has(event) && this._states[event]) {
            callback.call(this);
            return callback;
        }

        // Check for duplicate registration
        if (cbs.has(callback)) {
            logger.warn(NAME, `Callback already registered for '${event}'`);
        } else {
            cbs.add(callback);
        }

        return callback;
    }

    /**
     * Remove a callback from an event.
     * Note: _lastRunTimeStamps uses WeakMap, so entries are automatically
     * garbage collected when callback becomes unreachable.
     *
     * @param {string} event - Event name
     * @param {Function} callback - Function to remove
     * @returns {boolean} True if callback was found and removed
     *
     * @example
     * const handler = (e) => console.log('Resize');
     * events.addListener('resize', handler);
     * // Later...
     * events.removeListener('resize', handler);
     */
    removeListener(event, callback) {
        const cbs = this._callbacks.get(event);

        if (!cbs) {
            logger.warn(NAME, `No such event: ${event}`);
            return false;
        }

        return cbs.delete(callback);
    }

    // ============================================================================
    // CONVENIENCE SHORTHAND METHODS
    // ============================================================================

    /**
     * Register callback for page fully loaded event (all resources including images).
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docLoaded(callback) {
        return this.addListener('docLoaded', callback);
    }

    /**
     * Register callback for DOM ready event (DOM parsed, resources may still load).
     * Fires immediately if DOM is already ready.
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docReady(callback) {
        return this.addListener('docReady', callback);
    }

    /**
     * Register callback for layout shifts (resize, scroll, visibility changes).
     * Useful for recalculating layouts or checking element visibility.
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docShift(callback) {
        return this.addListener('docShift', callback);
    }

    /**
     * Register callback for responsive breakpoint changes.
     * Event detail contains {name, matches, matchesAll, matchesNone}.
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    breakPointChange(callback) {
        return this.addListener('breakPointChange', callback);
    }

    /**
     * Register callback for when all non-lazy images have loaded.
     * Fires immediately if images are already loaded.
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    imgsLoaded(callback) {
        return this.addListener('imgsLoaded', callback);
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Ensure only one instance exists globally.
 * Prevents duplicate event binding if module is imported multiple times.
 * @type {EventHandler}
 */
if (typeof window !== 'undefined') {
    window.eventHandler = window.eventHandler || new EventHandler();
}

export default (typeof window !== 'undefined') ? window.eventHandler : new EventHandler();