/**
 * Class Toggler v2.1 (3-2023)
 * (C) hnldesign 2022
 * toggles classes based on events/evaluations
 */

import eventHandler from "./hnl.eventhandler.min.mjs";
import {hnlLogger} from "./hnl.logger.min.mjs";

const NAME = 'classToggler';
const BODY = document.body;


/**
 * Sets classes on the BODY element based on the percentage of the page scrolled.
 * @function
 */
function setScrollClasses() {
  // Ratio of the viewport height to the document height. If >= 1, there is no scrolling.
  const windowToBodyRatio = window.innerHeight / BODY.scrollHeight;

  // Toggle 'scrolled-top' class if at top of page.
  BODY.classList.toggle('scrolled-top', window.scrollY === 0);

  // If the page is scrollable, set classes based on scroll amount.
  if (windowToBodyRatio < 1) {
    const scrollAmount = Math.round((window.scrollY / window.innerHeight) * 10) / 10;

    // Toggle 'scrolled-end' class if at bottom of page (within 10px margin).
    BODY.classList.toggle(
      'scrolled-end',
      (window.scrollY + window.innerHeight - BODY.scrollHeight) >= -10 && window.scrollY !== 0,
    );

    // Toggle classes based on scroll percentage.
    BODY.classList.toggle('scrolled-10', scrollAmount >= 0.1);
    BODY.classList.toggle('scrolled-15', scrollAmount >= 0.15);
    BODY.classList.toggle('scrolled-25', scrollAmount >= 0.25);
    BODY.classList.toggle('scrolled-50', scrollAmount >= 0.5);
    BODY.classList.toggle('scrolled-75', scrollAmount >= 0.75);
    BODY.classList.toggle('scrolled-100', scrollAmount >= 1);

    // Set scrolling up or down classes based on previous scroll position.
    if (window.prevScrollY !== undefined && window.prevScrollY !== 0) {
      BODY.classList.toggle('scrolled-down', window.scrollY - window.prevScrollY >= 0);
      BODY.classList.toggle('scrolled-up', window.scrollY - window.prevScrollY < 0);
    }

    // Save previous scroll position for next comparison.
    window.prevScrollY = window.scrollY;
  } else {
    // Remove all scroll-related classes except 'scrolled-top'.
    BODY.classList.forEach((className) => {
      BODY.classList.toggle(className, !className.includes('scrolled-') || className.includes('scrolled-top'));
    });
  }
}

/**
 * Toggles classes based on breakpoints.
 * @function
 * @param {Event} e - The breakpoint change event.
 */
function onBreakpointChange(e) {
  BODY.classList.toggle(e.detail.name, e.detail.matches);
}
/**
 * Initializes the class toggler.
 */
export function classToggler() {
  hnlLogger.info(NAME, 'Running');

  //js feature detection
  BODY.classList.remove('no-js');
  BODY.classList.toggle('no-js-modules', !('noModule' in HTMLScriptElement.prototype));
  BODY.classList.toggle('no-debug', (!window.location.search.includes('debug=true')));

  //bind handling of scroll classes, and immediately run (addListener returns the assigned callback)
  //note: 'docShift' represents both a scroll or a resize event
  eventHandler.addListener('docShift', setScrollClasses)();

  eventHandler.breakPointChange(onBreakpointChange);

}