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


/** isVisible
 *
 * Determines whether an element is visible within the (specified, or Window) viewport. Executes the callback based
 * on that result. The callback is called with three parameters:
 * - a boolean that's true if the element is visible,
 * - the element's bounding box, including 'pageY' and 'pageX' which contain the element's position as relative to
 *   the whole document. Useful for scrolling into view,
 * - the viewport that was used to check against.
 *
 * The viewport can be omitted, specified partially or completely.
 *
 * Usage: isVisible(myElement, callback, {viewport object});
 *
 * @param {Element} element - The element to check
 * @param {Function} callback - The callback function to execute when done checking
 * @param {Object} viewport - The viewport object (optional) - falls back to the window if not provided
 * @param {number} viewport.top - The top position of the viewport (optional)
 * @param {number} viewport.bottom - The bottom position of the viewport (optional)
 * @param {number} viewport.left - The left position of the viewport (optional)
 * @param {number} viewport.right - The right position of the viewport (optional)
 *
 */
export function isVisible(element, callback, viewport = {}) {
  if (!(element instanceof Element)) {
    throw new TypeError('Not a valid node');
  }
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const clientTop = document.documentElement.clientTop;
  const clientLeft = document.documentElement.clientLeft;
  rect.pageY = rect.top + scrollTop - clientTop;
  rect.pageX = rect.left + scrollLeft - clientLeft;

  viewport = {
    top: typeof viewport.top !== 'undefined' ? viewport.top : 0,
    bottom: typeof viewport.bottom !== 'undefined' ? viewport.bottom : window.innerHeight || document.documentElement.clientHeight,
    left: typeof viewport.left !== 'undefined' ? viewport.left : 0,
    right: typeof viewport.right !== 'undefined' ? viewport.right : window.innerWidth || document.documentElement.clientWidth,
  };

  const vis = (
    (rect.height > 0 || rect.width > 0) &&
    rect.bottom < viewport.bottom &&
    rect.right < viewport.right &&
    rect.top > viewport.top &&
    rect.left > viewport.left
  );

  if (typeof callback === 'function') {
    callback.call(this, vis, rect, viewport);
  }
}

/**
 * Get the path of the current script file.
 *
 * @returns {string} The path of the current script file.
 */
export function getScriptPath() {
  if ('noModule' in HTMLScriptElement.prototype && typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
    // ES module support
    return new URL(import.meta.url).pathname;
  } else {
    // Legacy support
    let uriRegex  = new RegExp(/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?Â«Â»â€œâ€â€˜â€™]))/ig);
    let traceUrls = new Error().stack.match(uriRegex);
    return traceUrls[traceUrls.length - 1].substring(0, traceUrls[traceUrls.length - 1].lastIndexOf('/'));
  }
}


/**
 * Writes a CSS file to the page
 *
 * @param {string} src - The URL of the CSS file to load
 * @returns {boolean} - Returns true if the CSS file was successfully loaded
 * @throws {Error} - Throws an error if the src parameter is not provided
 */
export function writeCSS(src) {
  if (!src) {
    throw new Error(`No CSS file path provided`);
  }
  const link = document.createElement('link');
  link.setAttribute('type', 'text/css');
  link.setAttribute('rel', 'stylesheet');
  link.setAttribute('href', src);
  document.head.appendChild(link);
  return true;
}