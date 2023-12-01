//forEach polyfill
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function (callback, thisArg) {
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

// Performance polyfill
// @license http://opensource.org/licenses/MIT
// copyright Paul Irish 2015
// Added code by Aaron Levine from: https://gist.github.com/Aldlevine/3f716f447322edbb3671
// Some modifications by Joan Alba Maldonado.
// as Safari 6 doesn't have support for NavigationTiming, we use a Date.now() timestamp for relative values
// if you want values similar to what you'd get with real perf.now, place this towards the head of the page
// but in reality, you're just getting the delta between now() calls, so it's not terribly important where it's placed
// Gist: https://gist.github.com/jalbam/cc805ac3cfe14004ecdf323159ecf40e
if (!Date.now) {
  Date.now = function () {
    return new Date().getTime();
  }
}
(function () {
  if (window.performance && window.performance.now) {
    return;
  }
  window.performance = window.performance || {};
  if
  (
    window.performance.timing && window.performance.timing.navigationStart &&
    window.performance.mark &&
    window.performance.clearMarks &&
    window.performance.getEntriesByName
  ) {
    window.performance.now = function () {
      window.performance.clearMarks('__PERFORMANCE_NOW__');
      window.performance.mark('__PERFORMANCE_NOW__');
      return window.performance.getEntriesByName('__PERFORMANCE_NOW__')[0].startTime;
    };
  } else if (!("now" in window.performance)) {
    var nowOffset = Date.now();

    if (window.performance.timing && window.performance.timing.navigationStart) {
      nowOffset = window.performance.timing.navigationStart
    }

    window.performance.now = function now() {
      return Date.now() - nowOffset;
    }
  }
}());