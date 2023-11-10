/**
 * Dynamic Motion blur handler v4.2.0 - 10-11-2023
 *
 * Adds motion-blur on the fly to scroll elements. Further refinement of motionblur.mjs module.
 * Populates a CSS variable '--blur-filter' with the correct dynamic filter. Use this filter on any element *inside* the scroller, or on the scroller itself, to apply motion-blur (filter: var(--blur-filter);).
 *
 * Major change in this version is: using requestAnimationFrame for all crucial DOM (blur filter) updates
 *
 * @namespace dynamicMotionBlur
 */
export const NAME = 'dynamicMotionBlur';


/**
 * Default configuration for the motion blur effect.
 * @typedef {Object} MotionBlurConfig
 * @property {number} transitionTime - Transition time in milliseconds.
 * @property {number} speedThresh - Speed threshold.
 * @property {number} fps - Frames per second.
 * @property {Object} scroller - Scroller configuration.
 * @property {Object} events - Custom event names.
 */

/**
 * Default configuration for the motion blur effect.
 * @type {MotionBlurConfig}
 */
const defaults = {
  transitionTime: 60,
  speedThresh: 1,
  fps: 60,
  scroller: {},
  events: {
    scrollStart: "scrollStart",
    scrolling: "scrolling",
    scrollStop: "scrollStop",
    animationFrame: "animationFrame"
  },
};


class EasedMeanCalculator {
  constructor() {
    this.history = {};
  }

  getValue(value, type = 'default', resetHistory = false) {
    // Initialize history for the given type if not exists
    if (!this.history[type]) {
      this.history[type] = [];
    }

    // Add the current value to the history
    this.history[type].push(value);

    // Use only the last 3 values in the history
    const historyToUse = this.history[type].slice(-3);

    // Calculate the mean value
    return historyToUse.reduce((sum, val) => sum + val, 0) / historyToUse.length;
  }

  reset (type) {
    this.history[type] = [];
  }
}


/**
 * Initialize motion blur effect for elements.
 * @param {HTMLElement[]} elements - Array of elements to apply the effect.
 */
export function init(elements) {
  elements.forEach((elem, index) => {
    const options = { ...defaults };
    options.index = index;
    options.easer = new EasedMeanCalculator();
    setupElement(elem, options);
  });
}


/**
 * Set up the motion blur effect for a single element.
 * @param {HTMLElement} elem - The element to apply the effect.
 * @param {Object} options - Configuration options.
 */
function setupElement(elem, options) {
  elem.dispatcher = function (eventName, eventDetails) {
    const event = new CustomEvent(eventName, { detail: eventDetails, bubbles: true, cancelable: true });
    this.dispatchEvent(event);
  };

  elem.filter = createSVGFilter(options);
  elem.style.setProperty("--blur-filter", `url('#${elem.filter.filterId}')`);

  elem.addEventListener("scroll", (e) => {
    handleScroll(elem, options, e);
  });

  options.fpsCounter = (() => {
    let prevTime = 1;
    function fpsTimer() {
      const now = performance.now();
      const fps = 1000 / (now - prevTime);
      prevTime = now;
      options.fps = fps;
      elem.dispatcher(options.events.animationFrame, options);
      requestAnimationFrame(fpsTimer);
    }
    return requestAnimationFrame(fpsTimer);
  })();

  setupEvents(elem, options);
}



/**
 * Handles the scroll event for an element.
 * @param {HTMLElement} elem - The target element.
 * @param {Object} options - The options associated with the element.
 * @param {Event} event - The scroll event.
 */
function handleScroll(elem, options, event) {

  if (!options.scroller.scrolling) {
    options.scroller.scrolling = true;
    options.scroller.computedStyle = window.getComputedStyle(elem);
    options.scroller.horizontal = (elem.dataset.scrollDirection === 'horizontal');
    options.scroller.width = elem.offsetWidth;
    options.scroller.height = elem.offsetHeight;

    options.factor = getPerformanceScale(elem, options);
    options.shutterAngle = getShutterAngle(elem);
    options.speed = options.scroller.percentageNearSnap = options.blur = 0;
    options.easer.reset('speed');
    options.transitionTime = Math.floor((1000/options.fps) * 5); //30 = half a second

    elem.style.setProperty('--blur-fade', `${options.transitionTime}ms`);

    elem.dispatcher(options.events.scrollStart, options);
  }

  // Watch for scrolling to come to a stop/end
  clearTimeout(options.scroller.scrollEndTimer);
  const timeOut = (options.scroller.horizontal
    ? (elem.scrollLeft % options.scroller.width === 0)
    : (elem.scrollTop % options.scroller.height === 0)) ? 0 : 150;
  options.scroller.scrollEndTimer = setTimeout(() => {
    if (options.scroller.scrolling) {
      // unset scrolling flag
      options.scroller.scrolling = false;
      // stop the watcher after next frame
      cancelAnimationFrame(options.scroller.watcher);
      options.scroller.watcher = null;
      // signal scrolling stopped
      options.scroller.snapped = !timeOut;
      elem.dispatcher(options.events.scrollStop, options);
    }
  }, timeOut);

  if (!options.scroller.watcher) {

    function watcher(timestamp) {
      options.scroller.thisTimeStamp = timestamp;
      // Calculate distance scrolled
      const scrollLeftDistance = elem.scrollLeft - (options.scroller.lastScrollLeft || 0);
      const scrollTopDistance = elem.scrollTop - (options.scroller.lastScrollTop || 0);
      options.distance = scrollLeftDistance || scrollTopDistance;

      // Dispatch scroll event
      elem.dispatcher(options.events.scrolling, options);

      // Update the last scroll positions for the next calculation
      options.scroller.lastScrollLeft = elem.scrollLeft;
      options.scroller.lastScrollTop = elem.scrollTop;
      options.scroller.prevTimeStamp = timestamp;

      // Keep the loop alive
      options.scroller.watcher = requestAnimationFrame(watcher);

    }

    options.scroller.watcher = requestAnimationFrame(watcher);
  }
}


/**
 * Sets up the custom events for an element.
 * @param {HTMLElement} elem - The DOM element to setup events on.
 * @param {Object} options - Configuration options for the blur effect.
 */
function setupEvents(elem, options) {
  for (const event in options.events) {
    elem.addEventListener(event, (event) => {
      handleCustomEvent(event, elem, options);
    });
  }
}


/**
 * Calculates the standard deviation value for the Gaussian blur based on the blur amount.
 * @param {object} options - The blur amount calculated from the scroll speed.
 * @param {HTMLElement} elem - The DOM element that scrolled.
 * @returns {string} - The standard deviation value for the SVG filter.
 */
function calculateStandardDeviation(elem, options) {
  return (options.scroller.horizontal) ? `${options.blur},0` : `0,${options.blur}`;
}


/**
 * Updates the blur effect based on the scroll data.
 * @param {HTMLElement} elem - The DOM element to update the effect on.
 * @param {Object} options - Configuration options for the blur effect.
 */
function updateBlurEffect(elem, options) {
  if (options.speed > options.speedThresh) {
    //elem.filter.adjust(calculateStandardDeviation(elem, options), options.transitionTime);
  }
  elem.filter.adjust(calculateStandardDeviation(elem, options), options.transitionTime);
}


/**
 * Gets the performance scaling factor from an element's computed style.
 * @param {HTMLElement} elem - The element to check for a performance scale.
 * @param {Object} options - Configuration options.
 * @returns {number} - The scaling factor.
 */
function getPerformanceScale(elem, options) {
  const scaleFactor = options.scroller.computedStyle.getPropertyValue('--scaler-perf');
  return !isNaN(parseInt(scaleFactor, 10)) ? parseInt(scaleFactor, 10) : 1;
}


/**
 * Gets the shutter angle from an element's dataset.
 * Note: adhering to the 180-degree Shutter Rule, the shutter speed
 * should be double the frame rate, assuming a web frame rate of 60fps.
 * @param {HTMLElement} elem - The element to check shutter angle for
 * @returns {number} - The shutter angle, or 180 if not present
 */
function getShutterAngle(elem) {
  return !isNaN(parseInt(elem.dataset.shutterAngle, 10)) ? parseInt(elem.dataset.shutterAngle, 10) : 180;
}


/**
 * Handles custom events dispatched during the motion blur effect.
 * @param {Event} event - The custom event object.
 * @param {HTMLElement} elem - The DOM element associated with the event.
 * @param {Object} options - Configuration options for the blur effect.
 */
function handleCustomEvent(event, elem, options) {
  switch (event.type) {
    case options.events.scrollStart:
      elem.classList.add('hnl-scrolling');
      break;
    case options.events.scrolling:
    case options.events.scrollStop:

      // Get speed
      options.speed = (event.type !== options.events.scrollStop) ? options.easer.getValue(Math.abs(options.distance) / (options.scroller.thisTimeStamp - (options.scroller.prevTimeStamp || 0)), 'speed') : 0;
      options.blur = calcBlur(options.speed, options.shutterAngle, options.fps) / options.factor;

      // Adjust the blur
      updateBlurEffect(elem, options);

      elem.classList.toggle('hnl-scrolling', (event.type !== options.events.scrollStop));
      elem.classList.toggle('hnl-motionblurring', (options.speed > options.speedThresh) && (event.type === options.events.scrolling));

      break;
    case options.events.animationFrame:
      //
      break;
    default:
      console.warn(`Unhandled event type: ${event.type}`);
      break;
  }
}

/**
 * Calculates the appropriate deviation for an feGaussianBlur SVG filter to simulate motion blur.
 * It's based on shutter speed and motion speed to mimic film motion blur at 24fps.
 *
 * The SVG filter's 'deviation' parameter is more of a factor in the convolution formula,
 * as opposed to an exact pixel value, requiring an approximation to achieve a visually correct blur.
 *
 * The deviation roughly translates to three times the pixel value on each side,
 * resulting in a ratio of 1/3.
 *
 * Three calculations are needed:
 *
 * - The length of one full film frame, in ms. Because of the 60fps vs 24fps difference, the amount of 'real' frames in one 'film' frame is 60/24 = 2.5
 *   Calculated as follows: (1000 / (fps || 60)) * (fps / 24);
 * - The exposure time per frame. (360/shutter) used as a factor: 1 being fully exposed, 0.5 half exposed, and 0 not exposed at all.
 *   Calculated as follows: (baseFrameTime / (360 / shutter))
 * - The amount of movement per exposure-time, in px/ms
 *   Calculated as follows: (exposureTimePerFrame * speed)
 *
 * Finally, to convert a distance in pixels back to the correct deviation, we'll do: (pixels * deviation ratio).
 * But since this produces twice the blur we want (since it blurs both ways), divide it by 2
 * Calculated as follows: (movementPerExposure * deviationRatio) / 2;
 *
 * The function is highly optimized, so these calculations are condensed into a few lines.
 *
 * @param {number} speed - the speed of motion in pixels per millisecond
 * @param {number} shutter - the shutter angle, with 180 as a film reference
 * @param {number} [fps=60] - the frame rate to use, defaulting to 60fps
 * @returns {number} The calculated deviation.
 */
function calcBlur(speed, shutter, fps = 60) {
  const deviationRatio = 1 / 3;
  // Convert 60fps to 24fps for film effect, adjusting the frame time accordingly.
  const exposureTimePerFrame = (1000 / fps * (fps / 24)) / (360 / shutter);
  // Calculate pixel movement per exposure, adjusting for two-way blur.
  return exposureTimePerFrame * speed * deviationRatio / 2;
}

/**
 * Creates an SVG filter for the motion blur effect.
 * @param {Object} options - Configuration options for the blur effect.
 * @returns {Object} - An object with methods to manipulate the SVG filter.
 */
function createSVGFilter(options) {
  const ns = 'http://www.w3.org/2000/svg';
  const filterId = `motionblur-filter-${options.index}`;
  const stdDeviationId = `motionblur-stddeviation-${options.index}`;
  const animatorId = `motionblur-animator-${options.index}`;

  // Create SVG elements
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'filters');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('id', `filter-svg-${options.index}`);

  const defs = document.createElementNS(ns, 'defs');
  const filter = document.createElementNS(ns, 'filter');
  filter.setAttribute('id', filterId);

  const feGaussianBlur = document.createElementNS(ns, 'feGaussianBlur');
  feGaussianBlur.setAttribute('in', 'SourceGraphic');
  feGaussianBlur.setAttribute('id', stdDeviationId);
  feGaussianBlur.setAttribute('edgeMode', 'duplicate');

  const animate = document.createElementNS(ns, 'animate');
  animate.setAttribute('attributeName', 'stdDeviation');
  animate.setAttribute('repeatCount', '1');
  animate.setAttribute('fill', 'freeze');
  animate.setAttribute('id', animatorId);

  // Construct the SVG filter structure
  feGaussianBlur.appendChild(animate);
  filter.appendChild(feGaussianBlur);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Insert the SVG into the DOM
  document.body.appendChild(svg);

  return {
    filterId,
    prevDev: null,
    adjust: function (stdDeviation, transitionTime = options.transitionTime) {
      animate.setAttribute('dur', `${transitionTime}ms`);
      animate.setAttribute('values', `${stdDeviation};0,0`);
      animate.beginElementAt(0);
    }
  }

}