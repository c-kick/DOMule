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
import fpsCounter from "./hnl.fps.mjs";

export const NAME = 'motionBlur';

const frameInterval = 60; //base interval for calculations. Recommended value is 60
const spindownTime = 400;
const blurThresh = 0.3; //deviation below this value is not considered noticeable motion blur
const scrollStart = new Event("scrollStart");
const scrollStop = new Event("scrollStop");
const blurStart = new Event("blurStart");
const blurStop = new Event("blurStop");

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

  animator.adjustFixedBlur = function (blurTrigger, value, dir) {
    //remove any animators in the svg filter, as we're now manually adjusting
    animator.remove();

    //round off to one decimal
    value = Math.round(value * 10) / 10;

    //set the actual blur
    const setValue = value ? (dir === 'horizontal' ? [value, 0] : [0, value]) : [0, 0];
    gb.setAttribute('stdDeviation', setValue.join(','));

    if (value <= blurThresh && blurTrigger.blurring) {
      blurTrigger.blurring = false;
      blurTrigger.dispatchEvent(blurStop);
    } else if (value > blurThresh && !blurTrigger.blurring) {
      blurTrigger.blurring = true;
      blurTrigger.dispatchEvent(blurStart);
    }
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
  //speed is in px/ms. Length of one frame in ms is now in 'exposure', now we'll blur half that distance.
  return ((speed * exposure) / 2 || 0);
}

let prevBlur;

function getBlur(speed, shutter, perf) {
  /* wrapper that provides some dampening of erratic blur */
  let blur = calcBlur(speed, shutter);
  blur = Math.round(blur * 10) / 10;
  let dampenedBlur = prevBlur ? ((prevBlur + blur) / 2) : blur;
  prevBlur = blur;
  return Math.round((blur / perf) * 10) / 10;
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

      //runs on start scroll
      function runStart(e) {
        if (!e.target.scrolling) {
          e.target.dispatchEvent(scrollStart);
          e.target.scrolling = true;
        }
        elem.classList.toggle('hnl-scrolling', e.target.scrolling);
      }

      //runs on start and during scroll
      function runStartWhile(e) {
        const elem = e.target;
        const horizontal = elem.getBlurDirection() === 'horizontal';

        const now = performance.now();
        const time = now - (elem.prevTimeStamp ? elem.prevTimeStamp : 0);
        const distance = horizontal ?
          elem.scrollLeft - (elem.prevScrollLeft ? elem.prevScrollLeft : 0) :
          elem.scrollTop - (elem.prevScrollTop ? elem.prevScrollTop : 0);
        elem.scrollSpeed = (Math.abs(distance)/time); //px/ms
        let pxRemain = horizontal ?
          (elem.scrollLeft % elem.offsetWidth) :
          (elem.scrollTop % elem.offsetHeight);
        pxRemain = (pxRemain === 0) ?
          0 :
          ((distance > 0) ?
            pxRemain :
            (horizontal ?
                elem.offsetWidth :
                elem.offsetHeight
            ) - pxRemain);
        const timeOut = (pxRemain === 0) ? 0 : 150;
        const multiplier = !isNaN(parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10)) ? parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10) : 1;
        const shutterangle = !isNaN(parseInt(e.target.dataset.shutterAngle, 10)) ? parseInt(e.target.dataset.shutterAngle, 10) : 180;

        clearTimeout(elem.scrollTimeout); //clear previous timeout, and start new one
        elem.scrollTimeout = setTimeout(function () {
          runStop(e);
          if (!timeOut) {
            //Scroller snapped!
          } else {
            //User stopped scrolling
          }
        }, timeOut);

        elem.blurAmount = getBlur(elem.scrollSpeed, shutterangle, multiplier);
        //elem.blurAnimator.adjustFixedBlur(elem.blurTrigger, e.target.blurAmount, elem.getBlurDirection())
        const decrease = e.target.blurAmount / (spindownTime / frameInterval);
        const numCompleteFrames = (spindownTime - (spindownTime % frameInterval)) / frameInterval;
        let x = 0;

        //stop any waiting spindowns
        if (elem.spinDown) {
          clearInterval(elem.spinDown);
          elem.spinDown = null;
        }

        //sets blur, and then spins down to zero within the 'spindownTime' timeframe
        elem.spinDown = setInterval(()=> {
          const complete = x / numCompleteFrames; //0 to 1
          const bezierMultiplier = (complete === 1 ? 1 : 1 - Math.pow(2, -10 * complete));
          const blur = (e.target.blurAmount - (e.target.blurAmount * bezierMultiplier));
          elem.blurAnimator.adjustFixedBlur(elem.blurTrigger, blur, elem.getBlurDirection());

          if (blur <= 0 || complete >= 1) {
            e.target.blurring = false;
            e.target.dispatchEvent(blurStop);
            clearInterval(elem.spinDown);
            elem.spinDown = null;
          }
          if (complete >= 0.5) { //remove class halfway
            e.target.classList.remove('hnl-motionblurring');
          }
          x++;
        }, frameInterval);

        //set classes
        e.target.classList.toggle('hnl-motionblurring', e.target.blurring);
        e.target.classList.toggle('hnl-scrolling', elem.scrollSpeed > 0);

        //store for next iteration
        elem.prevScrollTop = elem.scrollTop;
        elem.prevScrollLeft = elem.scrollLeft;
        elem.prevTimeStamp = now;
      }

      //runs after scroller has snapped or scrolling has stopped/paused long enough (150ms)
      function runStop(e) {
        //elem.blurAnimator.adjustFixedBlur(elem.blurTrigger, 0, elem.getBlurDirection());
        e.target.dispatchEvent(scrollStop);
        e.target.blurring = e.target.scrolling = false;
        e.target.classList.remove('hnl-motionblurring', 'hnl-scrolling');
      }

      //bind all above
      elem.blurTrigger.addEventListener('scroll', debounceThis((e) => {
        if (e.debounceType === 'start') {
          runStart(e);
        }
        runStartWhile(e);
      }, {
        threshold: frameInterval,
        execStart: true,
        execWhile: true,
        execDone: false
      }));

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