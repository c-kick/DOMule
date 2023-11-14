//forEach polyfill
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(callback, thisArg) {
    if (this == null) {
      throw new TypeError('this is null or not defined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    var O = Object(this);
    var len = O.length >>> 0;

    for (var k = 0; k < len; k++) {
      if (k in O) {
        callback.call(thisArg, O[k], k, O);
      }
    }
  };
}


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

/**
 * Strips HTML tags from string
 *
 * @param {string} string - The string to clean
 * @returns {string} - The cleaned string
 */
export function cleanUpString(string){
  return string.replace(/(<([^>]+)>)/ig, '').replace(/\s{2,}/g, ' ').trim(); //replaces 2+ spaces with 1
}

/**
 * Formats Dutch phone numbers
 *
 * @param {string} $phone - The string to format
 * @returns {string} - The formatted string
 */
export function formatPhone($phone) {
  let ret = [], countryPrefix, phone;
  const whiteSpace = /\s+/g;
  const areaPrefix = ['06','0909','0906','0900','0842','0800','0676','06','010','046','0111','0475','0113','0478','0114','0481','0115','0485','0117','0486','0118','0487','013','0488','015','0492','0161','0493','0162','0495','0164','0497','0165','0499','0166','050','0167','0511','0168','0512','0172','0513','0174','0514','0180','0515','0181','0516','0182','0517','0183','0518','0184','0519','0186','0521','0187','0522','020','0523','0222','0524','0223','0525','0224','0527','0226','0528','0227','0529','0228','053','0229','0541','023','0543','024','0544','0251','0545','0252','0546','0255','0547','026','0548','0294','055','0297','0561','0299','0562','030','0566','0313','0570','0314','0571','0315','0572','0316','0573','0317','0575','0318','0577','0320','0578','0321','058','033','0591','0341','0592','0342','0593','0343','0594','0344','0595','0345','0596','0346','0597','0347','0598','0348','0599','035','070','036','071','038','072','040','073','0411','074','0412','075','0413','076','0416','077','0418','078','043','079','045'];
  const areaPrefixSeparator = ' - '; //bijv ' - '  voor 030 - 123 45 67.

  phone = ((typeof $phone !== 'string') ? $phone.join('') : clean_string($phone)).replace(whiteSpace, '');

  if (phone.slice(0,2) === '00' || phone.slice(0,1) === '+') {
    countryPrefix = (phone.slice(0,1) === '+') ? phone.slice(0,3) : phone.slice(0,4);
    phone = '0' + phone.substring(countryPrefix.length);
    ret.push(countryPrefix);
  }

  let x = 5, kental = phone.slice(0, 3); //def eerste 3 cijfers.
  while(x--) {
    if (areaPrefix.includes(phone.slice(0,x))){
      kental = phone.slice(0, x);
      break;
    }
  }
  phone = phone.substring(kental.length);
  ret.push(kental.substr(countryPrefix ? 1 : 0) + areaPrefixSeparator);

  let regex = phone.length > 7 ? /(\d{2,3})(\d{2})(\d{2})(\d{2})/i : /(\d{2,3})(\d{2})(\d{2})/i
  let matches = phone.match(regex); //maakt groepjes: XXX XX XX bij 7 karakters of XX XX XX bij 6 of (andere regex) XX XX XX XX bij meer dan 7
  if (matches) {
    matches.shift();
    ret.push(matches.join(' '));
    return ret.join(' ').replace(/\s{2,}/g, ' ');
  } else {
    //do nothing
    return $phone;
  }
}

/**
 * Formats a string containing a url
 *
 * @param {string} string - The string to format
 * @returns {string} - The formatted string
 */
export function formatHref(string) {
  const https = 'https:';
  const parts = string.split('//');
  let uri = (parts.length === 1) ? parts[0] : parts[1];
  return (https + '//' + uri).replace(/\/{3,}/, '//');
}

/**
 * General string formatter, which implements methods above. Will auto format if no validateAs was passed
 *
 * @param {string} string - The string to format
 * @param {string} validateAs - The type of formatting to apply (defaults to 'auto')
 * @returns {string} - The formatted string
 */
export function formatString(string, validateAs = 'auto') {
  string = cleanUpString(string);
  const digitString = (string.match(/\d+/g) || []).join('');
  const wordString = (string.match(/[A-z]+/g) || []).join('');
  if ((digitString.length > 9 && digitString.length < 12 && !wordString.length) || validateAs === 'phone') {
    return formatPhone(digitString);
  } else if (/^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/.test(string)) {
    return formatHref(string);
  } else {
    return string;
  }
}


/**
 * Convert string to milliseconds
 * Source: https://stackoverflow.com/questions/30439694/converting-jquerys-css-timing-to-ms
 */
export function toMS(s) {
  return parseFloat(s) * (/\ds$/.test(s) ? 1000 : 1);
}


/**
 * Adds two events to a snap-scrolling element: scrollSnapped and scrollStopped. Apply function once, then listen for the events.
 * As created here: https://stackoverflow.com/questions/65952068/determine-if-a-snap-scroll-elements-snap-scrolling-event-is-complete/66029649#66029649
 *
 * NOTE: this NEEDS the element to have a set scroll direction using data attribute "data-scroll-direction" either as "horizontal" or "vertical".
 */
export function snapScrollComplete(element, callbackSnap, callbackStop) {
  let timeout = null;
  element.addEventListener('scroll', (e) => {
    let atSnappingPoint = (e.target.dataset.scrollDirection === 'horizontal') ? (e.target.scrollLeft % e.target.offsetWidth === 0) : (e.target.scrollTop % e.target.offsetHeight === 0);
    let timeOut         = atSnappingPoint ? 0 : 150;
    clearTimeout(timeout); timeout = null;
    timeout = setTimeout(function() {
      if (!timeOut) {
        e.target.dispatchEvent(new Event('scrollSnapped'));
        if (typeof callbackSnap === "function") callbackSnap.call(this);
      } else {
        e.target.dispatchEvent(new Event('scrollStopped'));
        if (typeof callbackSnap === "function") callbackStop.call(this);
      }
      e.target.dispatchEvent(new Event('scrollStoppedSnapped'));
    }, timeOut);
  });
}

/**
 * A class for measuring frames per second (FPS) and dispatching events.
 *
 * Usage:
 * new FpsCounter((fps)=> {
 *   //do stuff on every frame, using 'fps' as the current FPS value.
 * });
 *
 * @class
 */
export class FpsCounter {
  /**
   * Creates an instance of FpsCounter.
   *
   * @param {Function} callback - The callback function to be executed on each FPS update.
   */
  constructor(callback) {
    // Array to store timestamps for FPS calculation.
    this.timeStamps = [performance.now()];

    // Custom event for FPS updates.
    this.fpsEvent = new CustomEvent('fpsUpdate', { detail: this, bubbles: true, cancelable: true });

    //The callback function to be executed on each FPS update.
    this.callback = typeof callback === "function" ? callback : null;

    // Default FPS value.
    this.fps = 60;

    // The timer function for FPS calculation.
    this.fpsTimer = this.fpsTimer.bind(this);

    // Start the FPS counter.
    this.start();
  }
  //The timer function for FPS calculation.
  fpsTimer(now) {

    // Filter timestamps within the last second.
    this.timeStamps = this.timeStamps.filter((time) => (now - time) <= 1000);

    // Get realtime fps, if there's something to measure, else fall back to default (prevents peaks at start-up)
    this.realFPS = (this.timeStamps.length > 1) ? (1000 / (now - this.timeStamps[this.timeStamps.length - 1])) : this.fps;

    // Add the current timestamp.
    this.timeStamps.push(now);

    // Update the FPS value by counting the number of timestamps in our timeStamps 'bucket', and combining with real FPS.
    // This method leverages between weird FPS drops (in case of missed frames) and 'realtime' performance.
    this.fps = Math.round((this.timeStamps.length + this.realFPS) / 2);

    // Dispatch the FPS update event.
    window.dispatchEvent(this.fpsEvent);

    // Execute the callback with the current FPS.
    if (this.callback) {
      this.callback.call(this, this.fps);
    }

    // Request the next animation frame.
    this.requestId = requestAnimationFrame(this.fpsTimer);
  }

  /**
   * Starts the FPS counter by requesting the first animation frame.
   */
  start() {
    this.requestId = requestAnimationFrame(this.fpsTimer);
  }
}


/**
 * EasedMeanCalculator class for calculating the mean value with easing.
 *
 * Example usage: const easer = new EasedMeanCalculator();
 *
 * Get mean value for value labeled 'fps':
 * easer.getValue(value, 'fps');
 *
 * Reset:
 * easer.reset('fps');
 *
 * For more info see JSDoc inside class.
 *
 * @class
 */
export class EasedMeanCalculator {
  /**
   * Creates an instance of EasedMeanCalculator.
   */
  constructor() {
    // Initialize an empty history object
    this.history = {};
  }

  /**
   * Gets the eased mean value for a given type and range.
   *
   * @param {number} value - The current value to be added to the history.
   * @param {string} [type='default'] - The type of history to use.
   * @param {number} [range=3] - The number of values to consider in the history.
   * @returns {number} - The eased mean value.
   */
  getValue(value, type = 'default', range = 3) {
    // Initialize history for the given type if it doesn't exist
    if (!this.history[type]) {
      this.history[type] = [];
    }

    // Add the current value to the history
    this.history[type].push(value);

    // Use only the last x values in the history
    const historyToUse = this.history[type].slice(-range);

    // Calculate the mean value with easing
    return historyToUse.reduce((sum, val) => sum + val, 0) / historyToUse.length;
  }

  /**
   * Resets the history for a given type.
   *
   * @param {string} type - The type of history to reset.
   */
  reset(type) {
    // Reset the history for the given type
    this.history[type] = [];
  }
}