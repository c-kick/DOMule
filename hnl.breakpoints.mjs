/**
 * Breakpoint handler v1.3 (5-2025)
 * (C) hnldesign 2022-2025
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
    { name: 'xs',   minPx:   0 },
    { name: 'sm',   minPx: 576 },
    { name: 'md',   minPx: 768 },
    { name: 'lg',   minPx: 992 },
    { name: 'xl',   minPx:1200 },
    { name: 'xxl',  minPx:1400 },
    { name: 'xxxl', minPx:1600 },
  ];

  // initialize a place to hold the current breakpoint
  // namespace it under your module name to avoid collisions
  window.__BREAKPOINT__ = { name: null, matchesAll: [], matchesNone: [] };

  function dispatchBreakpointChangeEvent(mql) {
    // update the global snapshot
    window.__BREAKPOINT__.name        = mql.name;
    window.__BREAKPOINT__.matchesAll  = mql.matchesAll;
    window.__BREAKPOINT__.matchesNone = mql.matchesNone;

    const event = new CustomEvent('breakPointChange', { detail: mql });
    document.dispatchEvent(event);
  }

  function setBreakpoints() {
    breakpoints.forEach(({ name, minPx }, i) => {
      // Compute the next break’s min-width, or treat it as “infinite”
      const nextMin = breakpoints[i + 1]?.minPx;
      const maxPx  = nextMin != null ? nextMin - 0.02 : null;

      // Build the media query string
      const mqString = maxPx
        ? `(min-width: ${minPx}px) and (max-width: ${maxPx}px)`
        : `(min-width: ${minPx}px)`;

      const mql = window.matchMedia(mqString);
      mql.name = name;

      // Precompute the arrays just once
      mql.matchesAll  = breakpoints.slice(0,   i + 1).map(bp => bp.name);
      mql.matchesNone = breakpoints.slice(i + 1).      map(bp => bp.name);

      // Only dispatch when this breakpoint becomes active
      mql.addEventListener('change', e => {
        if (e.matches) dispatchBreakpointChangeEvent(e.target);
      });

      // Fire initial event if it already matches
      if (mql.matches) {
        dispatchBreakpointChangeEvent(mql);
      }
    });
  }

  if (document.readyState !== 'loading') {
    setBreakpoints();
  } else {
    window.addEventListener('DOMContentLoaded', setBreakpoints);
  }

  return setBreakpoints;
})();