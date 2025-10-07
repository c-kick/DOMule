export const NAME = 'iteration';

/** objForEach
 Calls a provided function once for each property of an object, passing the property key, value, index, and object itself to the function.
 (C) 2021-2022 hnldesign

 @param {object} object - The object to iterate over.
 @param {function} callback - Function to execute for each property, taking four arguments: key, value, index, and the object being traversed.
 @param {function} [callbackDone] - Function to execute when the iteration is complete.
 @param {*} [thisArg=window] - Value to use as this when executing the callbacks.
 */

export function objForEach(object, callback, callbackDone, thisArg = window) {
    if (typeof object !== 'object' || object === null) {
        throw new TypeError('Not an object');
    }
    let c = 0;
    for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            callback.call(thisArg, key, object[key], c, object);
        }
        c++;
    }
    if (typeof callbackDone === 'function') {
        callbackDone.call(thisArg);
    }
}

/** forEachBatched
 *
 * Parses object data in batches (100 standard), for higher performance when writing to HTML during parsing
 * @param {Object} obj - The object to run on
 * @param {Function} callback - The callback to run for each record
 * @param {Function} doneCallback - The callback to run when done
 * @param {number} [batchSize=100] - The batch size (100 default)
 */
export function forEachBatched(obj, callback, doneCallback, batchSize = 100) {
    if (obj == null || typeof obj !== 'object') {
        throw new TypeError('Invalid input. Expected an object.');
    }

    if (typeof callback !== 'function' || typeof doneCallback !== 'function') {
        throw new TypeError('Invalid callback function(s).');
    }

    const keys = Object.keys(obj);
    const len = keys.length;

    let i = 0;
    const interval = 10; // run an entire batch (each) each 10ms

    const processData = (start) => {
        let end = Math.min(start + batchSize, len);
        while (start < end) {
            const key = keys[start];
            callback.call(obj, obj[key], key, obj);
            start++;
        }
        if (start < len) {
            setTimeout(() => processData(start), interval);
        } else {
            doneCallback.call(obj, obj[keys[len - 1]], keys[len - 1], obj);
        }
    };

    processData(i);
}