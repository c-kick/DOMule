import './hnl.polyfills.mjs';  // stays for now (could become util.polyfills.mjs)
import {debounceThis} from './util.debounce.mjs';
import {logger} from "./core.log.mjs";
export const NAME = 'eventHandler';

/**
 * Event handler v3.0 (10-2025)
 * (C) hnldesign 2022-2025
 *
 * Provides a centralized event management system with debounced handling,
 * breakpoint detection, and lifecycle events. Implements singleton pattern
 * to prevent duplicate bindings.
 *
 * Features:
 * - Automatic deduplication of callbacks within same animation frame
 * - Debounced resize/scroll with start/during/end phases
 * - Single-execution events that fire immediately if already occurred
 * - Automatic breakpoint detection and management
 * - Document visibility tracking
 * - Image and content load tracking
 *
 * Usage:
 *   import eventHandler from './hnl.eventhandler.mjs';
 *
 *   eventHandler.addListener('resize', (e) => {
 *     console.log('Window resized');
 *   });
 *
 * Available events:
 * - docReady: DOM content loaded
 * - docLoaded: All resources loaded (including images)
 * - imgsLoaded: All non-lazy images loaded
 * - startResize, resize, endResize: Window resize phases
 * - bodyResize: Body element dimension changes
 * - startScroll, scroll, endScroll: Scroll phases
 * - docShift: Combined resize/scroll/visibility change
 * - docBlur, docFocus: Document visibility changes
 * - breakPointChange: Responsive breakpoint changes
 */

/**
 * EventHandler class - Manages DOM and window events with intelligent debouncing
 * and deduplication. Automatically initializes as singleton.
 */
class EventHandler {

    constructor() {
        // Prevent multiple instantiation
        if (EventHandler._instance) {
            return EventHandler._instance;
        }
        EventHandler._instance = this;

        // Map each event name to Set of callback functions
        // Using Map/Set for O(1) operations and automatic deduplication
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

        // Track last execution timestamp per callback using WeakMap
        // When callback becomes unreachable, entry is garbage collected
        this._lastRunTimeStamps = new WeakMap();

        // Events allowed to fire multiple callbacks in same animation frame
        this._allowMultiple = new Set(['breakPointChange']);

        // Events that fire only once in page lifetime
        this._singleExecution = new Set(['docReady', 'docLoaded', 'imgsLoaded']);

        // Track which single-execution events have already fired
        this._states = {};

        // Track event timing for performance logging
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
     * Initialize document ready and load events
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
     * Initialize responsive breakpoint detection
     * Imports breakpoint handler which dispatches breakPointChange events
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
     * Initialize debounced window resize events
     * Provides start/during/end phases for efficient resize handling
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
     * Initialize body resize detection
     * Uses ResizeObserver when available, falls back to window resize proxy
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
     * Initialize debounced scroll events
     * Provides start/during/end phases with optimized thresholds
     * @private
     */
    _initScrollEvents() {
        // Scroll start (fires once at beginning)
        window.addEventListener('scroll', debounceThis((e) => {
            this._timestamps['scroll'] = performance.now();
            this._runListeners(['startScroll'], e);
        }, {execStart: true, execWhile: false, execDone: false}));

        // Scroll during (fires continuously while scrolling)
        // Threshold: 100ms for responsive feel
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
     * Initialize document visibility change events (tab switching, minimize, etc.)
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
     * Initialize image load tracking
     * Tracks when all non-lazy images have loaded
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
     * Execute all registered callbacks for given events
     * Batches execution in single animation frame and prevents duplicate calls
     * @param {string[]} events - Event names to trigger
     * @param {Event} [origEvent] - Original DOM event object to pass to callbacks
     * @private
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
     * Register a callback for an event
     * If event is single-execution and already occurred, callback fires immediately
     * @param {string} event - Event name
     * @param {Function} callback - Function to execute when event fires
     * @returns {Function} The callback (for chaining or immediate invocation)
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
     * Remove a callback from an event
     * @param {string} event - Event name
     * @param {Function} callback - Function to remove
     * @returns {boolean} True if callback was found and removed
     */
    removeListener(event, callback) {
        const cbs = this._callbacks.get(event);

        if (!cbs) {
            logger.warn(NAME, `No such event: ${event}`);
            return false;
        }

        const removed = cbs.delete(callback);

        // Note: _lastRunTimeStamps uses WeakMap, so entries are automatically
        // garbage collected when callback becomes unreachable

        return removed;
    }

    // ============================================================================
    // CONVENIENCE SHORTHAND METHODS
    // ============================================================================

    /**
     * Register callback for page fully loaded event (all resources)
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docLoaded(callback) {
        return this.addListener('docLoaded', callback);
    }

    /**
     * Register callback for DOM ready event (DOM parsed, resources may still load)
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docReady(callback) {
        return this.addListener('docReady', callback);
    }

    /**
     * Register callback for layout shifts (resize, scroll, visibility changes)
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    docShift(callback) {
        return this.addListener('docShift', callback);
    }

    /**
     * Register callback for responsive breakpoint changes
     * @param {Function} callback - Function to execute
     * @returns {Function} The callback
     */
    breakPointChange(callback) {
        return this.addListener('breakPointChange', callback);
    }

    /**
     * Register callback for when all non-lazy images have loaded
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
 * Ensure only one instance exists globally
 * Prevents duplicate event binding if module is imported multiple times
 */
if (typeof window !== 'undefined') {
    window.eventHandler = window.eventHandler || new EventHandler();
}

export default (typeof window !== 'undefined') ? window.eventHandler : new EventHandler();