/**
 * Dynamic Motion blur handler v4.0.1 - 7-11-2023
 *
 * Adds motion-blur on the fly to scroll elements. Further refinement of motionblur.mjs module.
 * Populates a CSS variable '--blur-filter' with the correct dynamic filter. Use this filter on any element *inside* the scroller, or on the scroller itself, to apply motion-blur (filter: var(--blur-filter);).
 *
 * Major change in this version is: accurate, smoothed blur. No more spindown on sudden stop; just sudden stop blur. No more hysteresis, less events, event details!
 */
export const NAME = 'dynamicMotionBlur';

const _defaults = {
    spinDownTime: 50, //time in ms to resolve an unfinished blur (abrupt stops, etc) make sure to sync this with your high quality image layer opacity transformation (--blur-fade-out) as the 'hnl-motionblurring' class will be unset right when easing kicks in
    blurThresh: 0.3, //deviation below this value is not considered noticeable motion blur
    meanN: 3, //N value for mean calculation
    events: {
        scrollStart: 'scrollStart',
        scrolling: 'scrolling',
        scrollStop: 'scrollStop',
        blurEaseStart: 'blurEaseStart',
        blurEaseStop: 'blurEaseStop',
    },
    eventDetails : null,
    defaultEventDetails: {
        speed : 0,
        blur: 0,
        smoothBlur: 0,
        valid: false,
        blurHistory: []
    }
}

/**
 * calcBlur
 * calculates the right amount of deviation for a feGaussianBlur filter, based on shutter-speed and motion-speed, to simulate film (@ 24fps) motion-blur.
 *
 * The trouble is that the SVG filter takes a parameter known as 'deviation', but this does not boil down to actual pixels. This deviation is used in the filter primitive,
 * inside a convolution formula (https://www.w3.org/TR/SVG11/filters.html#feGaussianBlurElement) so it's more of a factor than an actual pixel-value of the amount of blur.
 * This means that we need to apply some approximation, and let things match to how we feel it looks right. As most film is shot at 180, and film is the baseline for this
 * motion-blur calculation, I 'primed' this function using 180degree shutter, and came up with the below deviation calculation.
 *
 * After some experimentation (see https://code.hnldesign.nl/motionblur-scroller/v3/tests.php) I determined that the deviation produces at around 3 times that many pixels (ON BOTH SIDES!)
 * So a deviation of 1 will produce a blur of around the size of 3 pixels. This means the ratio is 1/3 = 0.33 (rounded off liberally)
 *
 * Note that the 180-degree Shutter Rule states that whatever the framerate the shutter speed should be double. We can assume 'web framerate' is, at most times, 60fps
 *
 * @param speed - the speed of motion, in pixels/ms
 * @param shutter - the shutter angle (film reference is 180)
 * @param fps - the actual FPS to use, instead of the hypothetical 60
 * @returns number - the calculated amount of deviation
 */
function calcBlur(speed, shutter, fps = 60) {
    const deviationRatio = 0.33;
    /**
     * We're going for a film-effect, at 24fps, so we'll need to 'pretend' 60fps is in fact 24fps. This means that 2.5 'real' frames equal 1 'film' frame (60/24).
     * This means we'll need to apply the shutter-angle to 2.5 frames instead of 1.
     */
    const baseFrameTime = (1000 / (fps || 60)) * (fps / 24); //length of one full film frame, in ms. Because of the 60fps vs 24fps difference, the amount of 'real' frames in one 'film' frame is 60/24 = 2.5
    const exposureTimePerFrame = (baseFrameTime / (360 / shutter)); //(360 / shutter) = factor of which a single frame is actually exposed
    // speed (in px/ms) is provided, so we can now calculate how many pixels were moved during one exposure
    const movementPerExposure = (exposureTimePerFrame * speed);
    // So to convert a distance in pixels back to the correct deviation, do: pixels * deviation ratio. But since this produces twice the blur we want (since it blurs both ways), divide it by 2
    return (movementPerExposure * deviationRatio) / 2;
}

function roundOff(value){
    return Math.floor(value * 10) / 10;
}

function createSVGFilter(element, index, options) {
    const ns = 'http://www.w3.org/2000/svg';
    const idx = `Filter${index}`;
    const filterRef = `Motionblur${idx}`;

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
    gb.setAttribute('id', `motionblurParams${idx}`);
    //gb.setAttribute('stdDeviation', '0,0');
    gb.setAttribute('edgeMode', 'duplicate');

    const animator = document.createElementNS(ns, 'animate');
    animator.setAttribute('attributeName', 'stdDeviation');
    animator.setAttribute('begin', 'beginEvent');
    animator.setAttribute('values', '0,0');
    animator.setAttribute('dur', `${options.spinDownTime}ms`);
    animator.setAttribute('repeatCount', '1');
    animator.setAttribute('fill', 'freeze');
    animator.setAttribute('restart', 'always');
    animator.setAttribute('id', `motionblurAnimator${idx}`);

    gb.appendChild(animator);
    filter.appendChild(gb);
    def.appendChild(filter);
    svg.appendChild(def);
    document.body.appendChild(svg);

    //assign filter as css variable to element
    element.style.setProperty('--blur-filter', `url('#${filterRef}')`);

    return {
        whenDone: null,
        stdDeviationValue: function (val) {
            return (element.dataset.scrollDirection === 'horizontal') ? `${val},0` : `0,${val}`;
        },
        adjust: function (blur) {

            animator.setAttribute('values', `${this.stdDeviationValue(blur)};0,0`);
            animator.beginElementAt(0);

            if (options.eventDetails.valid) {
                clearTimeout(this.whenDone);
                this.whenDone = null;
                element.dispatcher(options.events.blurEaseStart,  options.eventDetails);
                this.whenDone = setTimeout(() => {
                    element.dispatcher(options.events.blurEaseStop,  options.eventDetails);
                }, options.spinDownTime);
            }
        }
    }

}

function dispatcher(eventName, details) {
    // Create a new event with the specified type
    const event = new CustomEvent(eventName, {
        detail: details,
        bubbles: true, // Set to true if you want the event to bubble up through the DOM
        cancelable: true // Set to true if you want to allow canceling the event
    });

    // Dispatch the event on the provided element
    this.dispatchEvent(event);
}

export function init(elements) {
    elements.forEach((elem, index) => {
        //define options for this element
        const opts = {
            shutterAngle: !isNaN(parseInt(elem.dataset.shutterAngle, 10)) ? parseInt(elem.dataset.shutterAngle, 10) : 180,
            ..._defaults
        };

        //assign event dispatcher
        elem.dispatcher = dispatcher;

        //assign default event details
        opts.eventDetails = { ...opts.defaultEventDetails }

        //create svg filter, maintain a reference as this returns some functionality
        opts.filter = createSVGFilter(elem, index, opts);

        //handle logic from main scroll event
        elem.addEventListener('scroll', (e) => {
            //check if first scroll event
            if (!elem.scrolling) {
                //reevaluate shutter angle at start
                opts.shutterAngle = !isNaN(parseInt(elem.dataset.shutterAngle, 10)) ? parseInt(elem.dataset.shutterAngle, 10) : 180;
                //(re)assign event details to defaults
                opts.eventDetails = { ...opts.defaultEventDetails }
                opts.eventDetails.blurHistory = [];
                //dispatch scroll start event
                elem.dispatcher(opts.events.scrollStart,  opts.eventDetails);
            }

            //determine variables
            const horizontal = (elem.dataset.scrollDirection === 'horizontal') || (elem.scrollTop === elem.prevScrollTop);
            const now = performance.now();
            const time = now - (elem.prevTimeStamp ? elem.prevTimeStamp : 0);
            const distance = horizontal ? (elem.scrollLeft - (elem.prevScrollLeft ? elem.prevScrollLeft : 0)) : (elem.scrollTop - (elem.prevScrollTop ? elem.prevScrollTop : 0));
            const multiplier = !isNaN(parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10)) ? parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10) : 1;
            const rawFPS = !elem.scrolling ? 60 : 1000/time;
            const rawSpeed = !elem.scrolling ? 0 : (Math.abs(distance) / time); //px/ms
            const rawBlur = !elem.scrolling ? 0 : calcBlur(rawSpeed, opts.shutterAngle, rawFPS);

            //store values and assign to event details
            opts.eventDetails.speed = rawSpeed > 0 ? roundOff(rawSpeed) : 0;
            opts.eventDetails.blur = rawBlur > 0 ? roundOff(rawBlur / multiplier) : 0;
            //push blur to history array and calculate smoothed blur as mean from history array
            opts.eventDetails.blurHistory.push(opts.eventDetails.blur);
            const M = opts.eventDetails.blurHistory.slice(-opts.meanN);
            opts.eventDetails.smoothBlur = M.reduce((a, b) => a + b, 0) / M.length || 0;
            opts.eventDetails.valid = opts.eventDetails.smoothBlur >= opts.blurThresh;

            //store values for next iteration
            elem.prevScrollTop = elem.scrollTop;
            elem.prevScrollLeft = elem.scrollLeft;
            elem.prevTimeStamp = now;

            //set scrolling flag
            elem.scrolling = true;
            //dispatch scrolling event
            elem.dispatcher(opts.events.scrolling,  opts.eventDetails);

            //run the scroll/snap complete methodology
            //https://stackoverflow.com/questions/65952068/determine-if-a-snap-scroll-elements-snap-scrolling-event-is-complete/66029649#66029649
            clearTimeout(elem.scrollTimeout);
            const timeOut = (horizontal ? (elem.scrollLeft % elem.offsetWidth === 0) : (elem.scrollTop % elem.offsetHeight === 0)) && (opts.eventDetails.speed < 1) ? 0 : 150
            elem.scrollTimeout = setTimeout(() => {
                if (elem.scrolling) {
                    //stopped, everything back to zero, except history
                    opts.eventDetails = { ...opts.defaultEventDetails }
                    //dispatch scroll end event
                    elem.dispatcher(opts.events.scrollStop,  opts.eventDetails);
                    //unset scrolling flag
                    elem.scrolling = false;
                }
            }, timeOut);

        });

        //listen for created events, and do cosmetics & blur handling
        elem.addEventListener('scrollStart', (e) => {
            //console.log(e.type, e.details);
            elem.classList.add('hnl-scrolling');
        })
        elem.addEventListener('scrolling', (e) => {
            //console.log(e.type, e.details);
            //blur needs to be adjusted on every scroll, spindown handles smooth transition to scrollstop
            opts.filter.adjust(e.detail.smoothBlur);
            elem.classList.toggle('hnl-motionblurring', e.detail.valid);
        })
        elem.addEventListener('scrollStop', (e) => {
            //console.log(e.type, e.details);
            //opts.filter.adjust(e.details.smoothBlur);
            elem.classList.remove('hnl-scrolling', 'hnl-motionblurring');
        })
    })
}