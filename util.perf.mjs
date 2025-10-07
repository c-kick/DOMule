export const NAME = 'perf';

/**
 * Adds two events to a snap-scrolling element: scrollSnapped and scrollStopped.
 * Apply function once, then listen for the events.
 *
 * As created here: https://stackoverflow.com/questions/65952068/determine-if-a-snap-scroll-elements-snap-scrolling-event-is-complete/66029649#66029649
 *
 * NOTE: this NEEDS the element to have a set scroll direction using data attribute "data-scroll-direction" either as "horizontal" or "vertical".
 *
 * @param {HTMLElement} element - The snap-scrolling element.
 * @param {Function} callbackSnap - The callback function when snapping occurs.
 * @param {Function} callbackStop - The callback function when scrolling stops.
 */
export function snapScrollComplete(element, callbackSnap, callbackStop) {
    let timeout = null;
    element.addEventListener('scroll', (e) => {
        let atSnappingPoint = (e.target.dataset.scrollDirection === 'horizontal') ? (e.target.scrollLeft % e.target.offsetWidth === 0) : (e.target.scrollTop % e.target.offsetHeight === 0);
        let timeOut         = atSnappingPoint ? 0 : 150;
        clearTimeout(timeout); timeout = null;
        timeout = setTimeout(function() {
            if (!timeOut) {
                e.target.dispatchEvent(new Event('scrollSnapped'));
                if (typeof callbackSnap === "function") callbackSnap.call(this);
            } else {
                e.target.dispatchEvent(new Event('scrollStopped'));
                if (typeof callbackStop === "function") callbackStop.call(this);
            }
            e.target.dispatchEvent(new Event('scrollStoppedSnapped'));
        }, timeOut);
    });
}

/**
 * A class for measuring frames per second (FPS) and dispatching events.
 *
 * Usage:
 * new FpsCounter((fps)=> {
 *   //do stuff on every frame, using 'fps' as the current FPS value.
 * });
 *
 * @class
 */
export class FpsCounter {
    /**
     * Creates an instance of FpsCounter.
     *
     * @param {Function} callback - The callback function to be executed on each FPS update.
     */
    constructor(callback) {
        // Array to store timestamps for FPS calculation.
        this.timeStamps = [performance.now()];

        // Custom event for FPS updates.
        this.fpsEvent = new CustomEvent('fpsUpdate', { detail: this, bubbles: true, cancelable: true });

        //The callback function to be executed on each FPS update.
        this.callback = typeof callback === "function" ? callback : null;

        // Default FPS value.
        this.fps = 60;

        // The timer function for FPS calculation.
        this.fpsTimer = this.fpsTimer.bind(this);

        // Start the FPS counter.
        this.start();
    }
    //The timer function for FPS calculation.
    fpsTimer(now) {

        // Filter timestamps within the last second.
        this.timeStamps = this.timeStamps.filter((time) => (now - time) <= 1000);

        // Get realtime fps, if there's something to measure, else fall back to default (prevents peaks at start-up)
        this.realFPS = (this.timeStamps.length > 1) ? (1000 / (now - this.timeStamps[this.timeStamps.length - 1])) : this.fps;

        // Add the current timestamp.
        this.timeStamps.push(now);

        // Update the FPS value by counting the number of timestamps in our timeStamps 'bucket', and combining with real FPS.
        // This method leverages between weird FPS drops (in case of missed frames) and 'realtime' performance.
        this.fps = Math.round((this.timeStamps.length + this.realFPS) / 2);

        // Dispatch the FPS update event.
        window.dispatchEvent(this.fpsEvent);

        // Execute the callback with the current FPS.
        if (this.callback) {
            this.callback.call(this, this.fps);
        }

        // Request the next animation frame.
        this.requestId = requestAnimationFrame(this.fpsTimer);
    }

    /**
     * Starts the FPS counter by requesting the first animation frame.
     */
    start() {
        this.requestId = requestAnimationFrame(this.fpsTimer);
    }
}


/**
 * EasedMeanCalculator class for calculating the mean value with easing.
 *
 * Example usage: const easer = new EasedMeanCalculator();
 *
 * Get mean value for value labeled 'fps':
 * easer.getValue(value, 'fps');
 *
 * Reset:
 * easer.reset('fps');
 *
 * For more info see JSDoc inside class.
 *
 * @class
 */
export class EasedMeanCalculator {
    /**
     * Creates an instance of EasedMeanCalculator.
     */
    constructor() {
        // Initialize an empty history object
        this.history = {};
    }

    /**
     * Gets the eased mean value for a given type and range.
     *
     * @param {number} value - The current value to be added to the history.
     * @param {string} [type='default'] - The type of history to use.
     * @param {number} [range=3] - The number of values to consider in the history.
     * @returns {number} - The eased mean value.
     */
    getValue(value, type = 'default', range = 3) {
        // Initialize history for the given type if it doesn't exist
        if (!this.history[type]) {
            this.history[type] = [];
        }

        // Add the current value to the history
        this.history[type].push(value);

        // Use only the last x values in the history
        const historyToUse = this.history[type].slice(-range);

        // Calculate the mean value with easing
        return historyToUse.reduce((sum, val) => sum + val, 0) / historyToUse.length;
    }

    /**
     * Resets the history for a given type.
     *
     * @param {string} type - The type of history to reset.
     */
    reset(type) {
        // Reset the history for the given type
        this.history[type] = [];
    }
}

/**
 * Calculate the scroll percentage of a webpage.
 * @returns {number} The scroll percentage, ranging from 0 to 100.
 */
export function pageScrollPercentage() {
    // Calculate the scroll position in pixels
    const scrollPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    // Calculate the total height of the content
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;

    // If the document is smaller than the viewport, return 100%
    if (totalHeight <= 0) {
        return 100;
    }

    // Ensure the scroll percentage is between 0% and 100%
    return Math.min(100, Math.max(0, (scrollPosition / totalHeight) * 100));
}