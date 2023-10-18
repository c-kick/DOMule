/**
 *
 * debounceThis ES6 module v1.3 (03-2023)
 * Debounces/rate-limits the provided function (callback)
 *
 * Provides a way to debounce or rate-limit a function, which can be useful in scenarios where events may be
 * triggered frequently and rapidly, such as scrolling or resizing the window.
 *
 * Example usage:
 *
 * import {debounceThis} from "debouncer.mjs";
 *
 * window.addEventListener('scroll', debounceThis((e)=> {
 *    //function that will be debounced/rate-limited
 *    updateScrollPos('after-scroll');
 * }, {
 *    //optional parameters. Defaults:
 *   threshold: 150,   //The amount of time (in milliseconds) to wait before executing the callback function.
 *   execStart: false, //Whether to execute the callback function immediately on the first event.
 *   execWhile: false, //Whether to execute the callback function at each interval while the debouncing function is being called.
 *   execDone: true,   //Whether to execute the callback function once the debouncing function stops being called and the threshold has passed.
 * }))
 *
 * See demo at https://code.hnldesign.nl/demo/hnl.debounce.html
 */

const _defaults = {
  threshold: 100,
  execStart: false,
  execWhile: false,
  execDone: true,
}

export function debounceThis(callback, opts) {
  // get/set options
  let options = {
    timer: 0,
    whileTimer: 0,
    busy: false,
    ..._defaults,
    ...opts,
  };

  return function (...args) {
    clearTimeout(options.timer);

    if (!options.busy && options.execStart) {
      callback.apply(this, args);
      options.busy = true;
    }

    if (options.execWhile && !options.whileTimer) {
      options.whileTimer = setTimeout(() => {
        callback.apply(this, args);
        options.whileTimer = false;
      }, options.threshold);
    }

    options.timer = setTimeout(() => {
      options.busy = false;
      if (options.execDone) callback.apply(this, args);
      clearInterval(options.whileTimer);
    }, options.threshold);
  }
}