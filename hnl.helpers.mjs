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

/** isVisibleNow - isVisible V2 - 2024
 *
 * Determines whether an element is visible within the viewport. Executes the callback based
 * on that result. The callback is called with three parameters:
 * - visible: a boolean that's true if ANY part of the element is visible.
 * - fullyVisible: a boolean that's true if the ENTIRE element is visible.
 * - entry: the IntersectionObserverEntry object, which provides details about the intersection.
 *
 * The viewport's margins can be adjusted by specifying rootMargin in the options object.
 *
 * Usage: isVisible(myElement, callback, { rootMargin: '10px' });
 *
 * @param {Element} element - The element to check for visibility.
 * @param {Function} callback - The callback function to execute when done checking.
 * @param {Object} [options] - Options for configuring the viewport margins and threshold.
 * @returns {Function} A function that, when called, will disconnect the observer.
 */
export function isVisibleNow(element, callback, options = {}) {
  const { rootMargin = '0px', threshold = [0, 1] } = options;

  if (!(element instanceof Element)) {
    throw new TypeError('Not a valid node');
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const visible = entry.intersectionRatio > 0;
      const fullyVisible = entry.intersectionRatio === 1;

      if (typeof callback === 'function') {
        callback(visible, fullyVisible, entry);
      }
    });
  }, { rootMargin, threshold });

  observer.observe(element);

  // Returns a function to stop observing the element.
  // This can be called to clean up when the element is removed from the DOM,
  // or when you no longer need to track its visibility.
  return () => {
    observer.disconnect();
  };
}

/**
 * Monitors changes to the dimensions of an element and executes a callback function when a change occurs.
 *
 * @param {Element} element - The element to monitor for dimension changes.
 * @param {Function} callback - The callback function to execute when a dimension change is detected. Receives a ResizeObserverEntry object.
 */
export function isResizedNow(element, callback) {
  // Check if ResizeObserver is supported
  if (typeof ResizeObserver !== 'function') {
    console.warn('ResizeObserver is not supported in this browser.');
    return;
  }

  // Create a new ResizeObserver instance
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      // Invoke the callback with the entry
      callback(entry);
    }
  });

  // Start observing the specified element
  resizeObserver.observe(element);

  // Provide a way to stop observing
  return () => {
    resizeObserver.unobserve(element);
    resizeObserver.disconnect();
  };
}

/**
 * Monitors visibility of an element. Works if elements are blocked by other elements, etc.
 * @param element
 * @returns {Promise<void>}
 */
export async function watchVisibility(element, callback = null) {
  //step 1: monitor changes in visibility
  const visibilityObserver = isVisibleNow(element, (isVisible, isFullyVisible, visData)=>{
    element.dataset.visible = isVisible;
    element.dataset.fullyVisible = isFullyVisible;
    //step 2: set up resize check
    const resizeObserver = isResizedNow(element, (resData) => {
      if (typeof callback === 'function') {
        callback.call(this, isVisible, isFullyVisible, {visibilityObserver, resizeObserver, visibility_data: visData, resize_data: resData});
      }
    });
  });
}


/** isVisible
 *
 * Determines whether an element is visible within the (specified, or Window) viewport. Executes the callback based
 * on that result. The callback is called with three parameters:
 * - visible: a boolean that's true if ANY pixels of the element are visible
 * - fullyVisible: a boolean that's true if the ENTIRE element fits the viewport, and thus is wholly visible
 * - the element's bounding box, including 'pageY' and 'pageX' which contain the element's position as relative to
 *   the whole document. Useful for scrolling into view,
 *
 * The viewport can either be omitted, specified partially or completely.
 *
 * Usage: isVisible(myElement, callback, {viewport object});
 *
 * @param {Element} element - The element to check for visibility.
 * @param {Function} callback - The callback function to execute when done checking.
 * @param {Object} [vp] - Object (optional) containing top, bottom, left and right offsets of the viewport to check against - falls back to the Window if not provided.
 */
export function isVisible(element, callback, vp = {}) {
  if (!(element instanceof Element)) {
    throw new TypeError('Not a valid node');
  }
  if (typeof element.getBoundingClientRect === 'function') {

    const rect = element.getBoundingClientRect();

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const clientTop = document.documentElement.clientTop;
    const clientLeft = document.documentElement.clientLeft;

    rect.pageY = rect.top + scrollTop - clientTop;
    rect.pageX = rect.left + scrollLeft - clientLeft;

    const viewport = {
      top: typeof vp.top !== 'undefined' ? vp.top : 0,
      bottom: typeof vp.bottom !== 'undefined' ? vp.bottom : window.innerHeight || document.documentElement.clientHeight,
      left: typeof vp.left !== 'undefined' ? vp.left : 0,
      right: typeof vp.right !== 'undefined' ? vp.right : window.innerWidth || document.documentElement.clientWidth,
    };

    const fullyVisible = (
      (rect.height > 0 || rect.width > 0) &&
      rect.bottom < viewport.bottom &&
      rect.right < viewport.right &&
      rect.top > viewport.top &&
      rect.left > viewport.left
    );

    const visible = (
      (rect.height > 0 || rect.width > 0) &&
      rect.bottom >= 0 &&
      rect.top <= viewport.bottom &&
      ((rect.right > viewport.left && rect.right <= viewport.right) || (rect.left < viewport.right && rect.left >= viewport.left))
    )

    if (typeof callback === 'function') {
      callback.call(this, visible, fullyVisible, rect);
    }

  } else {
    console.error('Can\'t check visibility for', typeof this, this);
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
 * Formats a string containing a URL.
 *
 * @param {string} urlString - The URL string to format.
 * @returns {string} - The formatted URL string.
 */
export function formatHref(urlString) {
  const https = 'https:';
  const parts = urlString.split('//');
  const uri = parts.length === 1 ? parts[0] : parts[1];
  return (https + '//' + uri).replace(/\/{3,}/g, '//');
}


/**
 * General string formatter, which implements methods above. Will auto format if no validateAs was passed
 *
 * @param {string} string - The string to format.
 * @param {string} [validateAs='auto'] - The type of formatting to apply (defaults to 'auto').
 * @returns {string} - The formatted string.
 */
export function formatString(string, validateAs = 'auto') {
  // Clean up the input string
  string = cleanUpString(string);

  // Extract digits and words from the string
  const digitString = (string.match(/\d+/g) || []).join('');
  const wordString = (string.match(/[A-Za-z]+/g) || []).join('');

  // Apply phone number formatting
  if ((digitString.length > 9 && digitString.length < 12 && !wordString.length) || validateAs === 'phone') {
    return formatPhone(digitString);
  } else if (/^https?:\/\/\S+|www\.\S+/.test(string)) {
    // Apply URL formatting
    return formatHref(string);
  } else {
    // No formatting needed
    return string;
  }
}


/**
 * Convert string (e.g. '1s') to milliseconds
 * Source: https://stackoverflow.com/questions/30439694/converting-jquerys-css-timing-to-ms
 */
export function toMS(s) {
  return parseFloat(s) * (/\ds$/.test(s) ? 1000 : 1);
}


/**
 * Adds two events to a snap-scrolling element: scrollSnapped and scrollStopped.
 * Apply function once, then listen for the events.
 *
 * As created here: https://stackoverflow.com/questions/65952068/determine-if-a-snap-scroll-elements-snap-scrolling-event-is-complete/66029649#66029649
 *
 * NOTE: this NEEDS the element to have a set scroll direction using data attribute "data-scroll-direction" either as "horizontal" or "vertical".
 *
 * @param {HTMLElement} element - The snap-scrolling element.
 * @param {Function} callbackSnap - The callback function when snapping occurs.
 * @param {Function} callbackStop - The callback function when scrolling stops.
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
        if (typeof callbackStop === "function") callbackStop.call(this);
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

/**
 * Generates a random integer between the specified minimum (inclusive) and maximum (inclusive) values.
 *
 * @param {number} min - The minimum value for the random integer.
 * @param {number} max - The maximum value for the random integer.
 * @returns {number} A random integer between min and max (inclusive).
 */
export function getRandomInt(min, max) {
  // Ensure min and max are integers
  min = Math.ceil(min);
  max = Math.floor(max);

  // Generate and return a random integer
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate the y-coordinate of a cubic Bezier curve at a given t parameter.
 *
 * @param {number[]} controlPoints - An array of four control points [x1, y1, x2, y2].
 * @param {number} t - The parameter value ranging from 0 to 1.
 * @returns {number} - The y-coordinate of the cubic Bezier curve at the specified t.
 */
export function cubicBezier(controlPoints, t) {
  const [x1, y1, x2, y2] = controlPoints;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  /**
   * Calculate the x-coordinate of the cubic Bezier curve at a given t parameter.
   *
   * @param {number} t - The parameter value ranging from 0 to 1.
   * @returns {number} - The x-coordinate of the cubic Bezier curve at the specified t.
   */
  function sampleCurveX(t) {
    return ((ax * t + bx) * t + cx) * t;
  }

  /**
   * Solve for the t parameter corresponding to a given x-coordinate on the curve.
   *
   * @param {number} x - The x-coordinate to solve for.
   * @param {number} epsilon - The tolerance for the solution.
   * @returns {number} - The t parameter corresponding to the specified x-coordinate.
   */
  function solveCurveX(x, epsilon) {
    let t2 = x, d2, i;

    for (i = 0; i < 8; i++) {
      const x2 = sampleCurveX(t2) - x;
      if (Math.abs(x2) < epsilon) {
        return t2;
      }

      d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
      if (Math.abs(d2) < 1e-6) {
        break;
      }

      t2 -= x2 / d2;
    }

    const t1 = t2 - x2 / d2;
    return t1;
  }

  /**
   * Calculate the y-coordinate of the cubic Bezier curve at a given t parameter.
   *
   * @param {number} t - The parameter value ranging from 0 to 1.
   * @returns {number} - The y-coordinate of the cubic Bezier curve at the specified t.
   */
  function sampleCurveY(t) {
    return ((ay * t + by) * t + cy) * t;
  }

  const t1 = solveCurveX(t, 1e-6);
  return sampleCurveY(t1);
}

/**
 * Calculate the scroll percentage of a webpage.
 * @returns {number} The scroll percentage, ranging from 0 to 100.
 */
export function pageScrollPercentage() {
  // Calculate the scroll position in pixels
  const scrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
  // Calculate the total height of the content
  const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

  // If the document is smaller than the viewport, return 100%
  if (totalHeight <= 0) {
    return 100;
  }

  // Ensure the scroll percentage is between 0% and 100%
  return Math.min(100, Math.max(0, (scrollPosition / totalHeight) * 100));
}

/**
 * Converts an HTML string into a DOM Node or NodeList.
 *
 * If the input string represents a single HTML element, the function returns that element.
 * If the string contains multiple sibling elements, it returns a NodeList of those elements.
 * This function is useful for dynamically generating DOM elements from string templates.
 *
 * @param {string} string - The HTML string to be converted into DOM elements.
 * @returns {ChildNode | NodeList} A DOM Node if the string represents a single element, or a NodeList of nodes if the string contains multiple top-level elements.
 * @example
 * // For a single element string
 * const element = stringToObj('<div>Hello World</div>');
 * console.log(element); // Logs the div element
 *
 * // For a multi-element string
 * const nodeList = stringToObj('<div>Hello</div><span>World</span>');
 * console.log(nodeList); // Logs a NodeList containing the div and span
 */
export function stringToObj(string) {
  //A <template> internally uses a documentFragment. After the function terminates, this is eligible for garbage collection, so this is more memory efficient than using an actual DOM node
  const template = document.createElement('template');
  template.innerHTML = string.trim();
  const content = template.content;
  return content.childElementCount === 1 ? content.firstElementChild : content.children;
}