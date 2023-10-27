/**
 * Motion blur handler v1.1.2 - 23-10-2023
 *
 * Adds x-axis motionblur to elements with predictable animations (e.g. not touch-based or scroll-snapped)
 * Creates SVG filter for element(s), with an <animate> element containing the correct 'values' and 'dur' to conform
 * to the element's animation timing function and duration. Also handles triggering of the animation on transitionrun.
 */
import eventHandler from "./hnl.eventhandler.mjs";
import {hnlLogger} from "./hnl.logger.mjs";
import {toMS} from "./hnl.helpers.mjs";
import {debounceThis} from "./hnl.debounce.mjs";

export const NAME = 'motionBlur';

function vwTOpx(value) {
  value = parseFloat(value);
  return ((window.innerWidth || document.element.clientWidth || document.getElementsByTagName('body')[0].clientWidth) * value) / 100;
}

function motionBlur(distance, speed) {
  const time = distance / speed; // Calculate time taken to cover the distance
  const blurAmount = time * speed; // Calculate the blur amount in pixels
  const blurFactor = 0.8; //lower = more blurry. Basically takes the pixels traveled per second, and cuts by this factor.
  return blurAmount > 0 ? Math.floor((blurAmount / blurFactor) * 10) / 10 : 0;
}

function getFrameBlurValues(bezierFormula, range, time, direction = 'horizontal') {
  if (!bezierFormula) return;
  const duration = time / 1000; // convert time to seconds
  const numFrames = Math.round(duration * 120); //how many frames are we going to specify per second? Higher gives better results. 120 works nicely.
  const blurValues = [];

  let yNext = null;
  for (let i = 0; i <= numFrames; i++) {
    const t = i / numFrames;
    const yValue = yNext ? yNext : (range[0] + cubicBezier(bezierFormula, t) * (range[1] - range[0]));
    yNext = ((i + 1) <= numFrames) ? range[0] + cubicBezier(bezierFormula, ((i + 1) / numFrames)) * (range[1] - range[0]) : yValue;

    if (yNext !== null) {
      const dist = Math.abs(yNext - yValue);
      const speed = Math.round(dist / (duration / numFrames));
      if (direction === 'horizontal') {
        blurValues.push(`${motionBlur(dist, speed)},0`);
      } else if (direction === 'vertical') {
        blurValues.push(`0,${motionBlur(dist, speed)}`);
      }
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
      'ease': [0.25, 0.1, 0.25, 1.0],
      'linear': [0.0, 0.0, 1.0, 1.0],
      'ease-in': [0.42, 0, 1.0, 1.0],
      'ease-out': [0, 0, 0.58, 1.0],
      'ease-in-out': [0.42, 0, 0.58, 1.0],
    };
    match = window.getComputedStyle(elem)['transition'].match(/\w\s\S+\s([\w\-?]+)\s?/);
    if (match) {
      return transitionTimings[match[1]] ? transitionTimings[match[1]] : transitionTimings['ease-in-out'];
    } else {
      return undefined;
    }
  }
}

function createSVGFilter(element, index, direction) {
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
    const moveDuration = parseFloat(toMS(style.getPropertyValue('transition-duration').split(',')[0]));
    const frameValues = getFrameBlurValues(extractCubicBezier(blurTrigger), [0, moveAmount], moveDuration, direction);
    if (frameValues) {
      animator.setAttribute('values', frameValues.join(';'));
      animator.setAttribute('dur', `${Math.floor((moveDuration ? moveDuration : 250) / 2)}ms`);
    }
  }

  animator.adjustBlur = function (blurTrigger, value, dir) {
    value = value ? (dir === 'horizontal' ? [value, 0] : [0, value]) : [0, 0];
    animator.remove();
    gb.setAttribute('stdDeviation', value.join(','));
  }

  return animator;
}

/**
 * getXY
 * gets x and y coordinates for css transform values, taken from the transform matrix (https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix)
 *
 * @param elem - the element to measure
 * @returns {(number[]|string)[]} -  array with x and y, and an assessment of the direction (vertical or horizontal) based on prior values
 */
function getXY(elem) {
  elem.prevXY = elem.prevXY ? elem.prevXY : [0, 0];
  const transform = window.getComputedStyle(elem).getPropertyValue('transform');
  const xy = (transform === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : transform).split(',').slice(-2).map((v) => parseFloat(v));
  const direction = (xy[0] !== elem.prevXY[0] ? 'horizontal' : (xy[1] !== elem.prevXY[1] ? 'vertical' : 'unknown'));
  elem.prevXY = xy;
  return ([xy, direction]);
}

function calcBlur(speed, shutter) {
  /* The 180-degree Shutter Rule states that whatever the framerate the shutter speed should be double. */
  let shutterSpeed = ((60 * 360) / shutter); // 60fps is screen refresh rate. Do not confuse this with requestAnimationFrame/FPS.
  let exposure = 1000 / shutterSpeed; //length of 1 frame of exposure (in ms).
  let blurmagic = (exposure / shutterSpeed);
  return Math.round((speed * blurmagic || 0) * 2) / 2;
}

let prevBlur;

function getBlur(speed, shutter, perf) {
  /* wrapper that provides some dampening of erratic blur */
  let blur = calcBlur(speed, shutter) / perf;
  blur = prevBlur ? ((prevBlur + blur) / 2) : blur;
  prevBlur = blur;
  return Math.round(blur * 2) / 2;
}

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-requires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(elements) {

  elements.forEach((elem, index) => {

    //set up data attributes
    elem.blurEnabled = false;
    elem.blurTrigger = (typeof elem.dataset.blurTrigger !== 'undefined' && document.getElementById(elem.dataset.blurTrigger) !== null) ?
      document.getElementById(elem.dataset.blurTrigger) : elem;
    elem.getBlurDirection = () => {
      return ((typeof elem.dataset.blurDirection !== 'undefined') ? elem.dataset.blurDirection : ((typeof elem.dataset.scrollDirection !== 'undefined') ? elem.dataset.scrollDirection : 'horizontal'))
    }
    elem.blurAnimator = createSVGFilter(elem, index, elem.getBlurDirection());

    /* check which type is needed:
    SPEED - Monitors an element's scrolling speed, and dynamically applies this as blur values to the SVG filter parameters. Needs a lot of optimization, mainly for mobile devices.
    FIXED - Gets the element's transform/animating properties and extracts the bezier curve, and uses all this data to set up a fixed animation for the SVG filter, which is triggered on transition events
    */
    if (elem.dataset.blurType === 'speed') {
      let threshold = 60;

      //runs on start scroll
      function runStart(e) {
        elem.classList.add('scrolling');
      }

      //runs on start, while and after scroll
      function runAlways(e) {
        e.target.scrollSpeed = (typeof e.target.lastPos !== "undefined") ? Math.abs(e.target.scrollLeft - e.target.lastPos) : 0;
        e.target.lastPos = e.target.scrollLeft;
        e.target.scrollStopped = e.target.scrollSpeed <= 0;

        const multiplier = parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10);
        e.target.blurAmount = getBlur(e.target.scrollSpeed, 180, !isNaN(multiplier) ? multiplier : 1);
        elem.blurAnimator.adjustBlur(elem.blurTrigger, e.target.blurAmount, elem.getBlurDirection());
      }

      //runs after scroll is done
      function runStop(e) {
        e.target.classList.remove('hnl-motionblurring', 'scrolling');
      }

      //bind all above
      elem.blurTrigger.addEventListener('scroll', debounceThis((e) => {
        if (e.debounceType === 'start') {
          runStart(e);
        }
        runAlways(e);
      }, {
        threshold: threshold,
        execStart: true,
        execWhile: true,
        execDone: true
      }));
      elem.blurTrigger.addEventListener('scroll', (e) => {
        let distance = e.target.scrollLeft - (e.target.prevScrollLeft ? e.target.prevScrollLeft : 0);
        let pxRemain = e.target.scrollLeft % e.target.offsetWidth;
        pxRemain = (pxRemain === 0) ? 0 : ((distance > 0) ? pxRemain : e.target.offsetWidth - pxRemain);
        e.target.prevScrollLeft = e.target.scrollLeft;
        let atSnappingPoint = pxRemain === 0;
        const timeOut = atSnappingPoint ? 0 : 150; //see notes
        clearTimeout(e.target.scrollTimeout); //clear previous timeout
        e.target.scrollTimeout = setTimeout(function () {
          runStop(e);
          if (!timeOut) {
            //Scroller snapped!
          } else {
            //User stopped scrolling
          }
        }, timeOut);

        e.target.classList.toggle('hnl-motionblurring', e.target.blurAmount > 0);
        e.target.classList.toggle('scrolling', !e.target.scrollStopped);

      }, {capture: false});

    } else if (!elem.dataset.blurType || elem.dataset.blurType === 'fixed') {

      elem.transDelay = parseInt(window.getComputedStyle(elem.blurTrigger).getPropertyValue('--transition-delay'), 10) || 0;

      //get/set starting x and y values
      elem.blurTrigger.prevXY = getXY(elem.blurTrigger);

      elem.blurTrigger.addEventListener('transitionstart', (e) => {
        if (e.propertyName === 'transform' && elem.blurEnabled && (e.target === elem.blurTrigger)) {

          if ((elem.getBlurDirection() === getXY(elem.blurTrigger)[1])) {
            setTimeout(() => {
              elem.blurAnimator.beginElement();
              elem.classList.add('hnl-motionblurring');
            }, elem.transDelay);
          }
        }
      }, {capture: false});
      elem.blurTrigger.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'transform' && elem.blurEnabled && (e.target === elem.blurTrigger)) {
          elem.classList.remove('hnl-motionblurring');
          elem.blurTrigger.prevXY = getXY(elem.blurTrigger);
        }
      }, {capture: false});

    }

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