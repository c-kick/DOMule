/** This script adds the current breakpoint-name (as specified in the 'breakpoints' const)
 * to the body class and notifies anyone listening of the change via the 'breakPointChanged' event.
 *
 * Default breakpoint names and cutoff pixel values taken from Bootstrap 5's default responsive breakpoints:
 * https://getbootstrap.com/docs/5.0/layout/breakpoints/
 *
 * Usage:
 * - include the script into your page and the class is updated, and will continue to update whenever
 *   the width of the window changes enough to trigger another breakpoint.
 * - optionally listen for the event via:
 *   document.addEventListener('breakPointChange', (event) => {
 *       //do stuff
 *   });
 */
(function (module) {
    'use strict';
    window.setBreakpoints = module;
  }(
    (function () {
      if (typeof window.matchMedia === 'function') {

        function setBreakpoints() {
          const breakpoints = [
            {name: 'xs', min: 0},
            {name: 'sm', min: 576},
            {name: 'md', min: 768},
            {name: 'lg', min: 992},
            {name: 'xl', min: 1200},
            {name: 'xxl', min: 1400}
          ];
          let x = breakpoints.length;
          while (x--) {
            let name = breakpoints[x].name,
              pixMin = breakpoints[x].min,
              pixMax = breakpoints[x + 1] ? (breakpoints[x + 1].min - 0.02) : 0;
            let mediaQuery = '(min-width: ' + pixMin + 'px' + (pixMax ? ') and (max-width: ' + pixMax + 'px' : '') + ')';
            let runQuery = window.matchMedia(mediaQuery);

            runQuery.addEventListener('change', function (e) {
                e.name = name;
                document.dispatchEvent(new CustomEvent('breakPointChange', {detail: e}));
              }
            );
            //run on init
            runQuery.name = name;
            document.dispatchEvent(new CustomEvent('breakPointChange', {detail: runQuery}));
          }
        }

        if (document.readyState !== 'loading') {
          setBreakpoints();
        } else {
          window.addEventListener("DOMContentLoaded", setBreakpoints);
        }

        return setBreakpoints;
      }
    }())
  )
);