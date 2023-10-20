/**
 * Motion blur handler v1.1.1 - 25-5-2023
 *
 * Adds x-axis motionblur to elements with predictable animations (e.g. not touch-based or scroll-snapped)
 * Creates SVG filter for element(s), with an <animate> element containing the correct 'values' and 'dur' to conform
 * to the element's animation timing function and duration. Also handles triggering of the animation on transitionrun.
 */
import eventHandler from "https://code.hnldesign.nl/js-modules/hnl.eventhandler.mjs";
import {hnlLogger} from "./hnl.logger.mjs";

export const NAME = 'motionBlur';

function vwTOpx(value) {
  value = parseFloat(value);
  return ((window.innerWidth || document.element.clientWidth || document.getElementsByTagName('body')[0].clientWidth) * value) / 100;
}

function motionBlur(distance, speed) {
  const time = distance / speed; // Calculate time taken to cover the distance
  const blurAmount = time * speed; // Calculate the blur amount in pixels
  const blurFactor = 0.8; //lower = more blurry. Basically takes the pixels traveled per second, and cuts by this factor.
  return blurAmount > 0 ? Math.floor((blurAmount / blurFactor) * 10) /10 : 0;
}

function getFrameBlurValues(bezierFormula, range, time) {
  if (!bezierFormula) return;
  const duration = time / 1000; // convert time to seconds
  const numFrames = Math.round(duration * 120); //how many frames are we going to specify per second? Higher gives better results. 120 works nicely.
  const blurValues = [];

  let yNext = null;
  for (let i = 0; i <= numFrames; i++) {
    const t = i / numFrames;
    const yValue = yNext ? yNext : (range[0] + cubicBezier(bezierFormula, t) * (range[1] - range[0]));
    yNext = ((i + 1) <= numFrames) ? range[0] +  cubicBezier(bezierFormula, ((i + 1) / numFrames)) * (range[1] - range[0]) : yValue;

    if (yNext !== null) {
      const dist = Math.abs(yNext - yValue);
      const speed = Math.round(dist/(duration/numFrames));
      blurValues.push(`${motionBlur(dist, speed)},0`);
    }
  }

  return blurValues;
}

function cubicBezier([x1, y1, x2, y2], t) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t) {
    return ((ax * t + bx) * t + cx) * t;
  }

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

  function sampleCurveY(t) {
    return ((ay * t + by) * t + cy) * t;
  }

  const t1 = solveCurveX(t, 1e-6);

  return sampleCurveY(t1);
}

function extractCubicBezier(elem) {
  // Match the cubic-bezier function using a regular expression
  let match = window.getComputedStyle(elem)['transition'].match(/\w\s.*\scubic-bezier\(([^)]+)\)/);
  if (match) {
    // If a match is found, return the cubic-bezier function as an array of four numbers
    return match[1].split(',').map(parseFloat);
  } else {
    // If no match is found, see if it is named
    const transitionTimings = {
      'ease' :        [0.25, 0.1, 0.25, 1.0],
      'linear' :      [0.0, 0.0, 1.0, 1.0],
      'ease-in' :     [0.42, 0, 1.0, 1.0],
      'ease-out' :    [0, 0, 0.58, 1.0],
      'ease-in-out' : [0.42, 0, 0.58, 1.0],
    };
    match = window.getComputedStyle(elem)['transition'].match(/\w\s\S+\s([\w\-?]+)\s?/);
    if (match) {
      return transitionTimings[match[1]] ? transitionTimings[match[1]] : transitionTimings['ease-in-out'];
    } else {
      return undefined;
    }
  }
}

function createSVGFilter(element, index) {
  const ns = 'http://www.w3.org/2000/svg';
  const idx = `filter-${index}`;
  const filterRef = `motionblur-${idx}`;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'filters');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('id', idx);

  const def = document.createElementNS(ns, 'defs');

  const filter = document.createElementNS(ns, 'filter');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'auto');
  filter.setAttribute('id', filterRef);

  const gb = document.createElementNS(ns, 'feGaussianBlur');
  gb.setAttribute('in', 'SourceGraphic');
  gb.setAttribute('id', `motionblur-params-${idx}`);
  gb.setAttribute('stdDeviation', '0,0');
  gb.setAttribute('edgeMode', 'wrap');

  const animator = document.createElementNS(ns, 'animate');
  animator.setAttribute('attributeName', 'stdDeviation');
  animator.setAttribute('begin', 'indefinite');
  animator.setAttribute('values', '0');
  animator.setAttribute('dur', '250ms');
  animator.setAttribute('repeatCount', '1');
  animator.setAttribute('fill', 'remove');
  animator.setAttribute('id', `motionblur-animator-${idx}`);

  gb.appendChild(animator);
  filter.appendChild(gb);
  def.appendChild(filter);
  svg.appendChild(def);
  document.body.appendChild(svg);

  element.style.setProperty('--blur-filter', `url('#${filterRef}')`);

  animator.adjust = function (blurTrigger) {
    const style = window.getComputedStyle(blurTrigger);
    const moveAmount = style.getPropertyValue('--move-amount').includes('px') ?
      parseInt(style.getPropertyValue('--move-amount'), 10) :
      vwTOpx(style.getPropertyValue('--move-amount'));
    const moveDuration = parseFloat(style.getPropertyValue('--move-duration'));
    const frameValues = getFrameBlurValues(extractCubicBezier(blurTrigger), [0, moveAmount], moveDuration);
    if (frameValues) {
      animator.setAttribute('values', frameValues.join(';'));
      animator.setAttribute('dur', `${Math.floor(moveDuration / 2)}ms`);
    }
  }

  return animator;
}

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-requires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(elements) {

  elements.forEach((elem, index) => {

    elem.blurEnabled = false;
    elem.blurAnimator = createSVGFilter(elem, index);
    elem.blurTrigger = (typeof elem.dataset.blurTrigger !== 'undefined' && document.getElementById(elem.dataset.blurTrigger) !== null) ?
      document.getElementById(elem.dataset.blurTrigger) : elem;
    elem.transDelay = parseInt(window.getComputedStyle(elem.blurTrigger).getPropertyValue('--transition-delay'),10) || 0;

    elem.blurTrigger.addEventListener('transitionrun', (e) => {
      if (e.propertyName === 'transform' && elem.blurEnabled && (e.target === elem.blurTrigger)) {
        setTimeout(() => {
          elem.blurAnimator.beginElement();
          elem.classList.add('hnl-motionblurring');
        }, elem.transDelay);
      }
    }, {capture: false});
    elem.blurTrigger.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform' && elem.blurEnabled && (e.target === elem.blurTrigger)) {
        elem.classList.remove('hnl-motionblurring');
      }
    }, {capture: false});

  });

  function prepare() {
    elements.forEach((elem, index) => {
      elem.blurAnimator.adjust(elem.blurTrigger);
      elem.blurEnabled = true;
    });
  }

  eventHandler.addListener('startResize', (e) => {
    elements.forEach((elem, index) => {
      elem.blurEnabled = false;
    });
  });
  eventHandler.addListener('endResize', prepare);
  eventHandler.addListener('docReady', prepare);
}