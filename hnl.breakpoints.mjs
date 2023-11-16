/**
 * Breakpoint handler v1.2 (10-2023)
 * (C) hnldesign 2022-2023
 *
 * This module adds the current breakpoint-name (as specified in the 'breakpoints' const)
 * to the body class and notifies anyone listening of the change via the 'breakPointChange' event.
 *
 * Default breakpoint names and cutoff pixel values taken from Bootstrap 5's default responsive breakpoints:
 * https://getbootstrap.com/docs/5.0/layout/breakpoints/
 *
 * This module has no init, and is self-invoking wherever included
 *
 * Usage:
 * - include the script into your page and the class is updated, and will continue to update whenever
 *   the width of the window changes enough to trigger another breakpoint.
 * - optionally listen for the event via:
 *   document.addEventListener('breakPointChange', (event) => {
 *       //do stuff
 *   });
 */
export const NAME = 'BreakpointHandler';

export const BreakpointHandler = (function () {
  'use strict';

  const breakpoints = [
    { name: 'xs', minPx: 0 },
    { name: 'sm', minPx: 576 },
    { name: 'md', minPx: 768 },
    { name: 'lg', minPx: 992 },
    { name: 'xl', minPx: 1200 },
    { name: 'xxl', minPx: 1400 }
  ];

  function dispatchBreakpointChangeEvent(detail) {
    const event = new CustomEvent('breakPointChange', { detail: detail?.target || detail });
    document.dispatchEvent(event);
  }

  function setBreakpoints() {
    for (let x = 0; x < breakpoints.length; x++) {
      const { name, minPx } = breakpoints[x];
      //below is optional chaining. Fallback would be const maxPx = breakpoints[x + 1] ? breakpoints[x + 1].minPx - 0.02 : 0;]
      const maxPx = breakpoints[x + 1]?.minPx - 0.02 || 0;

      const mediaQuery = `(min-width: ${minPx}px${maxPx ? `) and (max-width: ${maxPx}px` : ''})`;
      const MediaQueryList = window.matchMedia(mediaQuery);
      MediaQueryList.name = name;

      //handler to run on each media query match (change) event
      MediaQueryList.addEventListener('change', dispatchBreakpointChangeEvent);

      //run once directly, to apply directly for the current breakpoint
      dispatchBreakpointChangeEvent(MediaQueryList);
    }
  }

  if (document.readyState !== 'loading') {
    setBreakpoints();
  } else {
    window.addEventListener('DOMContentLoaded', setBreakpoints);
  }

  return setBreakpoints;
})();