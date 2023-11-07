/**
 * Dynamic Motion blur handler v4.1.0 - 8-11-2023
 *
 * Adds motion-blur on the fly to scroll elements. Further refinement of motionblur.mjs module.
 * Populates a CSS variable '--blur-filter' with the correct dynamic filter. Use this filter on any element *inside* the scroller, or on the scroller itself, to apply motion-blur (filter: var(--blur-filter);).
 *
 * Major change in this version is: accurate, smoothed blur. No more spindown on sudden stop; just sudden stop blur. No more hysteresis, less events, event details!
 */
export const NAME = 'dynamicMotionBlur';

const defaults = {
    spinDownTime: 50,
    blurThresh: 0.3,
    meanN: 3,
    events: {
        scrollStart: 'scrollStart',
        scrolling: 'scrolling',
        scrollStop: 'scrollStop',
    }
};

/**
 * Initializes the motion blur on provided elements.
 * @param {Array} elements - The DOM elements to initialize the blur effect on.
 */
export function init(elements) {
    elements.forEach((elem, index) => {
        const options = {
            ...defaults
        };
        elem.dispatcher = function(eventName, eventDetails) {
            // Create a new event with the specified type
            const event = new CustomEvent(eventName, {
                detail: eventDetails,
                bubbles: true, // Set to true if you want the event to bubble up through the DOM
                cancelable: true // Set to true if you want to allow canceling the event
            });

            // Dispatch the event on the provided element
            this.dispatchEvent(event);
        }
        //create filter for the element
        elem.filter = createSVGFilter(index, options);
        //assign filter as css variable to element
        elem.style.setProperty('--blur-filter', `url('#${elem.filter.filterId}')`);
        //assign listener for scroll event
        elem.addEventListener('scroll', (event) => handleScrollEvent(elem, options, event));
        //set up events
        setupEvents(elem, options);
    });
}

/**
 * Handles the scroll event for an element.
 * @param {HTMLElement} elem - The DOM element that scrolled.
 * @param {Object} options - Configuration options for the blur effect.
 * @param {Event} event - The scroll event object.
 */
function handleScrollEvent(elem, options, event) {
    //reevaluate direction and shutter angle
    options.horizontal = (elem.dataset.scrollDirection === 'horizontal') || (elem.scrollTop === elem.prevScrollTop);
    options.shutterAngle = getShutterAngle(elem);
    const scrollData = calculateScrollData(elem, options);
    updateBlurEffect(elem, options, scrollData);

    if (!elem.scrolling) {
        elem.scrolling = true;
        elem.dispatcher(options.events.scrollStart, scrollData);
    } else {
        elem.dispatcher(options.events.scrolling, scrollData);
    }
    clearTimeout(elem.scrollTimeout);
    const timeOut = (options.horizontal ? (elem.scrollLeft % elem.offsetWidth === 0) : (elem.scrollTop % elem.offsetHeight === 0)) && (scrollData.speed < 1) ? 0 : 150
    elem.scrollTimeout = setTimeout(() => {
        if (elem.scrolling) {
            //unset scrolling flag
            elem.scrolling = false;
            elem.dispatcher(options.events.scrollStop, scrollData);
        }
    }, timeOut);

    // Save the current scroll position and timestamp for the next event
    elem.prevScrollTop = elem.scrollTop;
    elem.prevScrollLeft = elem.scrollLeft;
}


/**
 * Calculates the speed of scrolling for an element.
 * @param {HTMLElement} elem - The element that is scrolling.
 * @param {Object} event - The scroll event.
 * @returns {number} - The speed of scrolling in pixels per millisecond.
 */
function calcSpeed(elem, event) {
    const now = performance.now();
    const timeElapsed = now - (elem.prevTimeStamp || now);
    const distance = isHorizontal(elem) ?
        (elem.scrollLeft - (elem.prevScrollLeft || elem.scrollLeft)) :
        (elem.scrollTop - (elem.prevScrollTop || elem.scrollTop));

    // Save the current timestamp for the next event
    elem.prevTimeStamp = now;
    // Calculate the speed of scrolling (pixels/ms)
    return timeElapsed > 0 ? Math.abs(distance / timeElapsed) : 0;
}

/**
 * Gets the performance scaling factor from an element's computed style.
 * @param {HTMLElement} elem - The element to check for a performance scale.
 * @returns {number} - The scaling factor.
 */
function getPerformanceScale(elem) {
    const scaleFactor = window.getComputedStyle(elem).getPropertyValue('--scaler-perf');
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
 * Calculates the scroll data needed for motion blur effect.
 * @param {HTMLElement} elem - The DOM element that scrolled.
 * @param {Object} options - Configuration options for the blur effect.
 * @returns {Object} - Calculated scroll data including speed and blur amount.
 */
function calculateScrollData(elem, options) {
    // Check if this is a new scroll, if so reset the blur history
    if (!elem.scrolling) {
        elem.blurHistory = [];
    }

    const speed = calcSpeed(elem, options);
    const factor = getPerformanceScale(elem);
    const blur = calcBlur(Math.abs(speed), options.shutterAngle, options.frameRate) / factor;
    // Update blur history, keep only the last 3 entries
    elem.blurHistory = [...elem.blurHistory.slice(-2), blur];
    const meanBlur = elem.blurHistory.reduce((acc, b) => acc + b, 0) / elem.blurHistory.length;

    return {
        speed: speed,
        blur: blur,
        smoothBlur: meanBlur,
        valid: meanBlur >= options.blurThresh
    };
}


/**
 * Updates the blur effect based on the scroll data.
 * @param {HTMLElement} elem - The DOM element to update the effect on.
 * @param {Object} options - Configuration options for the blur effect.
 * @param {Object} scrollData - The scroll data including speed and blur amount.
 */
function updateBlurEffect(elem, options, scrollData) {
    elem.filter.adjust(calculateStandardDeviation(scrollData.smoothBlur, elem));
    // ... (extract and refactor the relevant parts from the original event listener)
}

/**
 * Checks if the provided element is scrolling horizontally. Checks data-scroll-direction attribute on element first,
 * falls back to evaluating scroll positions.
 * @param elem - The DOM element to check scrolling direction for.
 * @returns {boolean} - True if it is scrolling horizontally, false if it's not (then assume it scrolls vertical)
 */
function isHorizontal(elem) {
    return elem.dataset.scrollDirection === 'horizontal' || elem.scrollTop === elem.prevScrollTop;
}

/**
 * Calculates the standard deviation value for the Gaussian blur based on the blur amount.
 * @param {number} blur - The blur amount calculated from the scroll speed.
 * @param {HTMLElement} elem - The DOM element that scrolled.
 * @returns {string} - The standard deviation value for the SVG filter.
 */
function calculateStandardDeviation(blur, elem) {
    // Depending on the scroll direction, adjust the standard deviation for the blur
    return (isHorizontal(elem)) ? `${blur},0` : `0,${blur}`;
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
            elem.classList.toggle('hnl-motionblurring', event.detail.valid);
            break;
        case options.events.scrollStop:
            elem.classList.remove('hnl-scrolling', 'hnl-motionblurring');
            break;
        default:
            console.warn(`Unhandled event type: ${event.type}`);
            break;
    }
    // ... (extract and refactor the relevant parts from the original custom event listeners)
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
    const deviationRatio = 1/3;
    // Convert 60fps to 24fps for film effect, adjusting the frame time accordingly.
    const exposureTimePerFrame = (1000 / fps * (fps / 24)) / (360 / shutter);
    // Calculate pixel movement per exposure, adjusting for two-way blur.
    return exposureTimePerFrame * speed * deviationRatio / 2;
}

/**
 * Creates an SVG filter for the motion blur effect.
 * @param {number} index - A unique index or identifier for the filter.
 * @param {Object} options - Configuration options for the blur effect.
 * @returns {Object} - An object with methods to manipulate the SVG filter.
 */
function createSVGFilter(index, options) {
    const ns = 'http://www.w3.org/2000/svg';
    const filterId = `motionblur-filter-${index}`;
    const stdDeviationId = `motionblur-stddeviation-${index}`;
    const animatorId = `motionblur-animator-${index}`;

    // Create SVG elements
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'filters');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('id', `filter-svg-${index}`);

    const defs = document.createElementNS(ns, 'defs');
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', filterId);

    const feGaussianBlur = document.createElementNS(ns, 'feGaussianBlur');
    feGaussianBlur.setAttribute('in', 'SourceGraphic');
    feGaussianBlur.setAttribute('id', stdDeviationId);
    feGaussianBlur.setAttribute('edgeMode', 'duplicate');

    const animate = document.createElementNS(ns, 'animate');
    animate.setAttribute('attributeName', 'stdDeviation');
    animate.setAttribute('dur', `${options.spinDownTime}ms`);
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
        whenDone: null,
        adjust: function (stdDeviation) {
            animate.setAttribute('values', `${stdDeviation};0,0`);
            animate.beginElementAt(0);
        }
    }

}