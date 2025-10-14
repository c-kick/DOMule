/**
 * @fileoverview Iteration Utilities - Object iteration with batching
 * @module util.iteration
 * @version 1.1.0
 * @author hnldesign
 * @since 2022
 */

export const NAME = 'iteration';

/**
 * Default batch size for batched iteration.
 * @private
 * @constant {number}
 */
const DEFAULT_BATCH_SIZE = 100;

/**
 * Interval between batches in milliseconds.
 * @private
 * @constant {number}
 */
const BATCH_INTERVAL = 10;

/**
 * Iterates over object properties with callbacks for each property and completion.
 *
 * @param {Object} object - Object to iterate
 * @param {Function} callback - Called for each property: (key, value, index, object)
 * @param {Function} [callbackDone] - Called when iteration completes
 * @param {*} [thisArg=undefined] - Value for 'this' in callbacks
 * @throws {TypeError} If object is null or not an object
 *
 * @example
 * const data = {a: 1, b: 2, c: 3};
 *
 * objForEach(data, (key, val, idx) => {
 *   console.log(`${idx}: ${key} = ${val}`);
 * }, () => {
 *   console.log('Done');
 * });
 * // Output:
 * // 0: a = 1
 * // 1: b = 2
 * // 2: c = 3
 * // Done
 */
export function objForEach(object, callback, callbackDone, thisArg = undefined) {
    if (typeof object !== 'object' || object === null) {
        throw new TypeError(`objForEach: expected object, got ${typeof object}`);
    }

    let index = 0;
    for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            callback.call(thisArg, key, object[key], index, object);
            index++;
        }
    }

    if (typeof callbackDone === 'function') {
        callbackDone.call(thisArg);
    }
}

/**
 * Iterates over object in batches to avoid blocking main thread.
 * Uses requestIdleCallback when available, setTimeout fallback.
 * Useful for processing large datasets without freezing UI.
 *
 * @param {Object} obj - Object to iterate
 * @param {Function} callback - Called for each property: (value, key, object)
 * @param {Function} doneCallback - Called when complete: (lastValue, lastKey, object)
 * @param {number} [batchSize=100] - Properties per batch
 * @throws {TypeError} If obj is null/undefined, or callbacks invalid
 *
 * @example
 * const largeData = {};
 * for (let i = 0; i < 10000; i++) {
 *   largeData[`key${i}`] = i;
 * }
 *
 * forEachBatched(
 *   largeData,
 *   (val, key) => {
 *     // Process each item
 *     console.log(`${key}: ${val}`);
 *   },
 *   () => {
 *     console.log('All 10,000 items processed');
 *   },
 *   250  // Process 250 items per batch
 * );
 *
 * @example
 * // Writing large dataset to DOM without freezing
 * const container = document.querySelector('.output');
 * forEachBatched(
 *   bigData,
 *   (val, key) => {
 *     const div = document.createElement('div');
 *     div.textContent = `${key}: ${val}`;
 *     container.appendChild(div);
 *   },
 *   () => console.log('DOM update complete'),
 *   50  // Small batches for DOM updates
 * );
 */
export function forEachBatched(obj, callback, doneCallback, batchSize = DEFAULT_BATCH_SIZE) {
    if (obj == null || typeof obj !== 'object') {
        throw new TypeError(`forEachBatched: expected object, got ${typeof obj}`);
    }

    if (typeof callback !== 'function' || typeof doneCallback !== 'function') {
        throw new TypeError('forEachBatched: callback and doneCallback must be functions');
    }

    const keys = Object.keys(obj);
    const totalKeys = keys.length;

    /**
     * Processes a batch of properties.
     * @private
     */
    const processBatch = (startIndex) => {
        const endIndex = Math.min(startIndex + batchSize, totalKeys);

        // Process batch
        for (let i = startIndex; i < endIndex; i++) {
            const key = keys[i];
            callback.call(obj, obj[key], key, obj);
        }

        // Schedule next batch or complete
        if (endIndex < totalKeys) {
            scheduleNext(() => processBatch(endIndex));
        } else {
            const lastKey = keys[totalKeys - 1];
            doneCallback.call(obj, obj[lastKey], lastKey, obj);
        }
    };

    /**
     * Schedules next batch using best available API.
     * @private
     */
    const scheduleNext = (fn) => {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(fn, {timeout: BATCH_INTERVAL * 2});
        } else {
            setTimeout(fn, BATCH_INTERVAL);
        }
    };

    // Start processing
    processBatch(0);
}