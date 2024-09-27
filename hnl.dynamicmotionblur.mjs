import { FpsCounter, EasedMeanCalculator } from "./hnl.helpers.mjs?debug=true";

/**
 * Dynamic Motion blur handler v4.3.0 - 27-09-2024
 *
 * Adds motion-blur on the fly to scroll elements. Further refinement of motionblur.mjs module.
 * Populates a CSS variable '--blur-filter' with the correct dynamic filter. Use this filter on any element *inside* the scrollerData, or on the scrollerData itself, to apply motion-blur (filter: var(--blur-filter);).
 *
 * Major change in this version is: using requestAnimationFrame for all crucial DOM (blur filter) updates
 *
 * See an extensive demo in action @ https://code.hnldesign.nl/motionblur-scrollerData/?debug=true
 *
 * @namespace dynamicMotionBlur
 */
export const NAME = 'dynamicMotionBlur';


/**
 * Default configuration for the motion blur effect.
 * @typedef {Object} MotionBlurConfig
 * @property {number} transitionTime - Transition time in milliseconds for the 'spin-down' blur effect, in case of dead-stops.
 * @property {number} speedThresh - Speed threshold in px/ms, above which the hnl-motionblurring class will be applied
 * @property {number} fps - Frames per second, will be recalculated during scrolling.
 * @property {Object} scrollerData - scroller data object.
 * @property {Object} events - Custom event names to dispatch on various scroll events.
 */
const defaults = {
  transitionTime: 60,
  speedThresh: 1,
  fps: 60,
  scrollerData: {},
  events: {
    scrollStart: "scrollStart",
    scrolling: "scrolling",
    scrollStop: "scrollStop",
  },
};


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
  // Set up a reusable dispatcher function for the element
  elem.dispatcher = function (eventName, eventDetails) {
    const event = new CustomEvent(eventName, { detail: eventDetails, bubbles: true, cancelable: true });
    this.dispatchEvent(event);
  };

  // Configure the SVG filter once and cache the result
  const { filterId } = options.filter = createSVGFilter(options);
  elem.style.setProperty("--blur-filter", `url('#${filterId}')`);

  // Set horizontal scrolling property based on the data attribute
  options.scrollerData.horizontal = (elem.dataset.scrollDirection === 'horizontal');

  // Assign the scroll event listener
  elem.addEventListener("scroll", (e) => {
    handleScroll(elem, options, e);
  });

  // Initialize FPS Counter to update `options.fps`
  new FpsCounter((fps)=> {
    options.fps = fps;
    //not used in this module, but useful for debugging, e.g. listening for 'fpsUpdate' and reading speed, blur, etc.
    elem.dispatchEvent(new CustomEvent('fpsUpdate', { detail: options, bubbles: true, cancelable: true }));
  });

  // Additional event setup for the element
  setupEvents(elem, options);
}



/**
 * Handles the scroll event for an element.
 * @param {HTMLElement} elem - The target element.
 * @param {Object} options - The options associated with the element.
 * @param {Object} event - The original scroll event (unused at the moment).
 */
function handleScroll(elem, options, event) {
  // Destructure options to extract the required properties
  const { scrollerData, events, fps, easer } = options;

  // Determine the scroll position based on direction
  const scrollPos = scrollerData.horizontal ? elem.scrollLeft : elem.scrollTop;
  const scrollDimension = scrollerData.horizontal ? scrollerData.width : scrollerData.height;

  // Check if first scroll event and initialize settings
  if (!scrollerData.scrolling) {
    scrollerData.horizontal = elem.dataset.scrollDirection === 'horizontal';
    scrollerData.scrolling = true;
    scrollerData.lastScrollPos = scrollPos;

    // Calculate additional options based on element properties
    options.factor = getPerformanceScale(elem);
    options.shutterAngle = getShutterAngle(elem);
    options.speed = options.blur = 0;
    options.transitionTime = Math.round(5000 / fps); // Sets the 'spin-down time' of the blur animation. 30 = half a second

    //reset the eased mean calculator for speed easing
    easer.reset('speed');

    // Dispatch the scroll start event
    elem.dispatcher(events.scrollStart, options);
  }

  // Debounce scroll stop detection
  clearTimeout(scrollerData.scrollEndTimer);
  const timeOut = (scrollPos % scrollDimension === 0) ? 0 : 150;
  scrollerData.scrollEndTimer = setTimeout(() => {
    if (scrollerData.scrolling) {
      // unset scrolling flag
      scrollerData.scrolling = false;
      // stop the watcher after next frame
      cancelAnimationFrame(scrollerData.watcher);
      scrollerData.watcher = null;
      // signal scrolling stopped
      scrollerData.snapped = !timeOut;
      elem.dispatcher(events.scrollStop, options);
    }
  }, timeOut);

  if (!scrollerData.watcher) {
    scrollerData.prevTimeStamp = performance.now();

    function watcher(timestamp) {
      const thisScrollPos = scrollerData.horizontal ? elem.scrollLeft : elem.scrollTop;

      scrollerData.thisTimeStamp = timestamp;
      // Calculate distance scrolled
      options.distance = thisScrollPos - (scrollerData.lastScrollPos || 0);

      // Dispatch scroll event
      elem.dispatcher(events.scrolling, options);

      // Update the last scroll positions for the next calculation
      scrollerData.lastScrollPos = thisScrollPos;
      scrollerData.prevTimeStamp = timestamp;

      // Keep watching
      scrollerData.watcher = requestAnimationFrame(watcher);

    }

    scrollerData.watcher = requestAnimationFrame(watcher);
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
  return (options.scrollerData.horizontal) ? `${options.blur},0` : `0,${options.blur}`;
}


/**
 * Updates the blur effect based on the scroll data.
 * @param {HTMLElement} elem - The DOM element to update the effect on.
 * @param {Object} options - Configuration options for the blur effect.
 */
function updateBlurEffect(elem, options) {
  options.filter.adjust(calculateStandardDeviation(elem, options), options.transitionTime);
}


/**
 * Gets the performance scaling factor from an element's computed style.
 * @param {HTMLElement} elem - The element to check for a performance scale.
 * @returns {number} - The scaling factor.
 */
function getPerformanceScale(elem) {
  return window.getComputedStyle(elem).getPropertyValue('--scaler-perf');
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
      options.speed = (event.type !== options.events.scrollStop) ? options.easer.getValue(Math.abs(options.distance) / (options.scrollerData.thisTimeStamp - (options.scrollerData.prevTimeStamp || 0)), 'speed') : 0;
      options.blur = calcBlur(options.speed, options.shutterAngle, options.fps) / options.factor;

      // Assign speed and distance to dataset for use in other scripts
      elem.dataset.speed = options.speed.toString();
      elem.dataset.distance = options.distance;

      // Adjust the blur
      updateBlurEffect(elem, options);

      elem.classList.toggle('hnl-scrolling', (event.type !== options.events.scrollStop));
      elem.classList.toggle('hnl-motionblurring', (options.speed > options.speedThresh) && (event.type === options.events.scrolling));

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

  // Utility function to create an SVG element with specified attributes
  const createSVGElement = (type, attributes = {}) => {
    const el = document.createElementNS(ns, type);
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  const filterId = `motionblur-filter-${options.index}`;
  const stdDeviationId = `motionblur-stddeviation-${options.index}`;
  const animatorId = `motionblur-animator-${options.index}`;

  // Create SVG elements using the utility function
  const svg = createSVGElement('svg', {
    class: 'filters',
    id: `filter-svg-${options.index}`
  });
  const defs = createSVGElement('defs');
  const filter = createSVGElement('filter', {id: filterId});
  const feGaussianBlur = createSVGElement('feGaussianBlur', {
    in: 'SourceGraphic',
    id: stdDeviationId,
    edgeMode: 'duplicate'
  });
  const animator = createSVGElement('animate', {
    attributeName: 'stdDeviation',
    repeatCount: '1',
    fill: 'freeze',
    id: animatorId
  });

  // Construct the SVG filter structure
  feGaussianBlur.appendChild(animator);
  filter.appendChild(feGaussianBlur);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Insert the SVG into the DOM
  document.body.appendChild(svg);

  // Return the filter object with an adjust method
  return {
    filterId,
    adjust: function (stdDeviation, transitionTime = options.transitionTime) {
      animator.setAttribute('dur', `${transitionTime}ms`);
      animator.setAttribute('values', `${stdDeviation};0,0`);
      animator.beginElementAt(0);
    }
  }

}