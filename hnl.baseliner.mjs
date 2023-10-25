/**
 * Baseline helper for images. Adjusts their parent figure, if they are in one
 */
import eventHandler from "./hnl.eventhandler.mjs";
import {isVisible} from "./hnl.helpers.mjs";
import {hnlLogger} from "./hnl.logger.mjs";

export const NAME = 'baseLiner';

const BASELINE_VAR = '--grid-base';
const BLOCK_ELEMENTS = ['img'];
const BASELINE_GRID_CLASS = '.align-baseline-grid';

function gcd(a, b) {
  if (b > a) {
    [a, b] = [b, a]; // Swap values of a and b using array destructuring
  }

  while (b !== 0) {
    [a, b] = [b, a % b]; // Update values of a and b simultaneously
  }

  return a;
}

/* ratio is to get the gcd and divide each component by the gcd, then return a string with the typical colon-separated value */
function ratio(x, y) {
  let c = gcd(x, y);
  return `${(x / c)} / ${(y / c)}`;
}

function conformToBaseline(el) {
  el.style.setProperty('aspect-ratio', null); //clear any aspect-ratio set earlier
  window.requestAnimationFrame(function () { //wait until next UI draw to measure height
    let gridSize = parseFloat(window.getComputedStyle(el).getPropertyValue(BASELINE_VAR));
    let rect = el.getBoundingClientRect();
    let roundedHeight = Math.ceil(rect.height / gridSize) * gridSize; //round off height to a multiple of grid size
    el.style.setProperty('aspect-ratio', ratio(rect.width, roundedHeight));
  });
}

function correctInlineGridElements() {
  document.querySelectorAll(BASELINE_GRID_CLASS + ' ' + BLOCK_ELEMENTS.join(', ' + BASELINE_GRID_CLASS + ' ')).forEach(function (el) {
    if (el.classList.contains('no-baseline-adjust')) return;
    const adjustEl = el.closest('figure') || el;

    if (el.complete) {
      //loadable element (e.g. img) that has already been loaded
      conformToBaseline(adjustEl);
    } else if (typeof el.complete !== "undefined") {
      //loadable element (e.g. img) that has not yet been loaded, bind to its onload handler
      el.onload = function () {
        conformToBaseline(adjustEl);
      }
    } else {
      //Not a loadable element, run immediately
      conformToBaseline(adjustEl);
    }
  });
}

//bind to breakpoint changes
eventHandler.breakPointChange(function(e){
  if (e.detail.matches) {
    correctInlineGridElements();
  }
});

//eventHandler.addListener('resize', correctInlineGridElements);
//eventHandler.addListener('scroll', correctInlineGridElements);

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-requires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(elements){
  correctInlineGridElements();
}