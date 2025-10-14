/**
 * @fileoverview Browser Polyfills - Provides missing APIs for older browsers
 * @module util.polyfills
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Essential polyfills for ES6 module-capable browsers lacking certain APIs.
 * Automatically applies patches when imported. No initialization needed.
 *
 * Browser Support Baseline:
 * - Chrome 61+ (ES6 modules since v61)
 * - Safari 10.1+ (ES6 modules since v10.1)
 * - Firefox 60+ (ES6 modules since v60)
 * - Edge 16+ (ES6 modules since v16)
 *
 * Polyfills Provided:
 * - Array.prototype.forEach (IE9+, but not needed for baseline)
 * - NodeList.prototype.forEach (Safari 10.1-13, Chrome 61-64)
 * - performance.now() (Safari 10.1-12, partial IE11/Edge <15)
 *
 * @example
 * // Just import - patches apply automatically
 * import './util.polyfills.mjs';
 *
 * @example
 * // After import, use standard APIs
 * document.querySelectorAll('div').forEach(el => {
 *   const timestamp = performance.now();
 * });
 */

export const NAME = 'polyfills';

// ============================================================================
// CONSTANTS
// ============================================================================

/** @private Performance mark name for timestamp calculation */
const PERF_MARK_NAME = '__PERFORMANCE_NOW__';

// ============================================================================
// ARRAY.PROTOTYPE.FOREACH POLYFILL
// ============================================================================

/**
 * Polyfill for Array.prototype.forEach (ES5).
 * Needed for: IE9-11 (below baseline, but harmless to include)
 *
 * @private
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach|MDN forEach}
 */
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(callback, thisArg) {
    if (this == null) {
      throw new TypeError('Array.prototype.forEach called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }

    const array = Object(this);
    const length = array.length >>> 0; // ToUint32

    for (let index = 0; index < length; index++) {
      if (index in array) {
        callback.call(thisArg, array[index], index, array);
      }
    }
  };
}

// ============================================================================
// NODELIST.PROTOTYPE.FOREACH POLYFILL
// ============================================================================

/**
 * Polyfill for NodeList.prototype.forEach.
 * Needed for: Safari 10.1-13.0, Chrome 61-64 (partial baseline coverage)
 *
 * Enables array-like iteration on NodeLists:
 * document.querySelectorAll('.class').forEach(el => {...})
 *
 * @private
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/NodeList/forEach|MDN NodeList.forEach}
 */
if (window.NodeList && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}

// ============================================================================
// PERFORMANCE.NOW() POLYFILL
// ============================================================================

/**
 * Polyfill for performance.now() high-resolution timestamps.
 * Needed for: Safari 10.1-12.0, IE11, Edge <15 (partial baseline coverage)
 *
 * Provides DOMHighResTimeStamp values relative to page load.
 * Falls back to Date.now() if no native implementation exists.
 *
 * Implementation priority:
 * 1. Native performance.now() (if exists)
 * 2. Performance marks (Chrome, newer browsers)
 * 3. Date.now() offset (fallback)
 *
 * @private
 * @license MIT
 * @author Paul Irish (original), Aaron Levine, Joan Alba Maldonado (modifications)
 * @see {@link https://gist.github.com/jalbam/cc805ac3cfe14004ecdf323159ecf40e|Original gist}
 */

// Date.now() polyfill for IE8 (below baseline, but harmless)
if (!Date.now) {
  Date.now = function() {
    return new Date().getTime();
  };
}

(function initPerformancePolyfill() {
  // Early exit if native implementation exists
  if (window.performance && window.performance.now) {
    return;
  }

  window.performance = window.performance || {};

  // Strategy 1: Use performance marks (Chrome 25+, Firefox 38+, Safari 11+)
  if (
      window.performance.timing &&
      window.performance.timing.navigationStart &&
      window.performance.mark &&
      window.performance.clearMarks &&
      window.performance.getEntriesByName
  ) {
    window.performance.now = function() {
      window.performance.clearMarks(PERF_MARK_NAME);
      window.performance.mark(PERF_MARK_NAME);
      return window.performance.getEntriesByName(PERF_MARK_NAME)[0].startTime;
    };
    return;
  }

  // Strategy 2: Offset from navigationStart or current time
  if (!('now' in window.performance)) {
    const navigationStart = window.performance.timing?.navigationStart || Date.now();

    window.performance.now = function() {
      return Date.now() - navigationStart;
    };
  }
})();