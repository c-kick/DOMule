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
 * hiresLoop
 * Setinterval, but using requestanimationframe
 * usage: hiresLoop(functiontorun, intervaltouse);
 * use this.stopLoop() inside your functiontorun to stop the loop.
 * callback runs after first interval. Set optional third parameter 'runOnStart' to true if you need a single first execution
 */
class hiresLooper {

  constructor() {

    this.state = {
      continue: true,
      frameSpeed: 0,
      elapsed: 0,
      index: 0,
      lastTime: 0
    }
    this.state  = {...this.defaults}

  }

  setInterval(callback, interval, runOnStart = false) {
    const state = {...this.defaults};
    function runLoop(timestamp) {
      state.continue = (typeof state.continue !== 'undefined') ? state.continue : true;
      state.elapsed = (typeof state.elapsed !== 'undefined') ? state.elapsed : 0;
      state.index = (typeof state.index !== 'undefined') ? state.index : 0;
      if (state.lastTime) {
        state.frameSpeed = timestamp - state.lastTime; //frame speed since last frame, in ms
        state.elapsed += state.frameSpeed;
        const x = Math.floor(state.elapsed / interval);
        if(x > state.index) {
          //run stuff here, set state.continue = false, or this.stopLoop() inside the callback, to stop the loop.
          if (typeof callback === 'function') {
            callback.call(state);
          }
          state.index = x;
        }
      }
      state.lastTime = timestamp;
      if (state.continue) {
        window.requestAnimationFrame(runLoop);
      }
    }
    window.requestAnimationFrame(runLoop);
  }

  clearInterval() {
    console.log('Stop');
    this.state.continue = false;
  }
  
}

export const hiresLoop = new hiresLooper();

/*
export function hiresLoop(callback, interval, runOnStart = false) {
  const state = {
    busy: false,
    continue: true,
    frameSpeed: 0,
    elapsed: 0,
    lastIteration: 0,
    lastTime: 0
  }

  const methods = {
    stopLoop: function() {
      state.continue = state.busy = false;
    }
  }

  //run single callback on start, if requested
  if (runOnStart && typeof callback === 'function') {
    //callback.call(methods, {...state});
  }

  function runLoop(timestamp) {
    state.continue = (typeof state.continue !== 'undefined') ? state.continue : true;
    state.elapsed = (typeof state.elapsed !== 'undefined') ? state.elapsed : 0;
    state.lastIteration = (typeof state.lastIteration !== 'undefined') ? state.lastIteration : 0;
    if (state.lastTime) {
      state.frameSpeed = timestamp - state.lastTime; //frame speed since last frame, in ms
      state.elapsed += state.frameSpeed;
      const x = Math.floor(state.elapsed / interval);
      if(x > state.lastIteration) {
        //run stuff here, set state.continue = false, or this.stopLoop() inside the callback, to stop the loop.
        if (typeof callback === 'function') {
          callback.call(methods, {...state});
        }
        state.lastIteration = x;
      }
    }
    state.lastTime = timestamp;
    if (state.continue) {
      window.requestAnimationFrame(runLoop);
    }
  }
  window.requestAnimationFrame(runLoop);

}*/