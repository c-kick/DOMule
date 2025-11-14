import {isUnobstructed, getBlockerHeight} from './util.observe.mjs';
import {logger} from './core.log.mjs';

export const NAME = 'ensure-visibility';

/**
 * Default sample offset from top edge for obstruction detection.
 * @private
 * @constant {number}
 */
const TOP_SAMPLE_OFFSET = 1;

/**
 * @fileoverview Viewport Scroller - Ensures element visibility with smart header detection
 * @module util.ensure-visibility
 * @version 1.1.0
 * @author hnldesign
 * @since 2025
 *
 * @description
 * Utility class for scrolling elements into view only when necessary.
 * Accounts for:
 * - Element position (top/bottom viewport boundaries)
 * - Fixed headers and overlays (stacked detection)
 * - Partial obstructions (other elements blocking view)
 *
 * Features:
 * - Single comprehensive visibility check
 * - Stacked header detection (multiple fixed elements)
 * - Configurable extra offset for breathing room
 * - Smart scroll targeting (minimal movement)
 * - Smooth or instant scrolling
 *
 * @example
 * // Basic usage
 * import {ViewportScroller} from './util.ensure-visibility.mjs';
 * const scroller = new ViewportScroller(document.querySelector('#target'));
 * scroller.ensureVisible();
 *
 * @example
 * // With custom options
 * const scroller = new ViewportScroller(element, {
 *   behavior: 'smooth',
 *   extraOffset: 20  // 20px gap below headers
 * });
 * scroller.ensureVisible();
 *
 * @example
 * // Instant scrolling for keyboard navigation
 * const scroller = new ViewportScroller(element, {behavior: 'auto'});
 * scroller.ensureVisible();
 */
export class ViewportScroller {
    /**
     * Creates viewport scroller for managing element visibility.
     *
     * @param {Element} el - DOM element to manage visibility for
     * @param {Object} [opts] - Configuration options
     * @param {'auto'|'smooth'} [opts.behavior='smooth'] - Scroll animation style
     * @param {number} [opts.extraOffset=0] - Additional spacing below headers (px)
     * @throws {TypeError} If el is not a DOM Element
     *
     * @example
     * const scroller = new ViewportScroller(
     *   document.querySelector('.modal'),
     *   {behavior: 'smooth', extraOffset: 12}
     * );
     */
    constructor(el, opts = {}) {
        if (!(el instanceof Element)) {
            throw new TypeError('ViewportScroller: el must be a DOM Element');
        }

        const {behavior = 'smooth', extraOffset = 0} = opts;

        this.el = el;
        this.behavior = behavior;
        this.extraOffset = extraOffset;
    }

    /**
     * Checks if element is fully visible and unobstructed.
     *
     * @private
     * @param {DOMRect} rect - Element bounding rectangle
     * @param {number} headerHeight - Combined height of blocking headers
     * @returns {{topHidden: boolean, bottomHidden: boolean, obstructed: boolean}}
     */
    _checkVisibility(rect, headerHeight) {
        const topHidden = rect.top < headerHeight + this.extraOffset;
        const bottomHidden = rect.bottom > window.innerHeight;

        // Only check obstruction if element appears to be in view
        let obstructed = false;
        if (!topHidden && !bottomHidden) {
            const midX = window.innerWidth / 2;
            const ySample = rect.top + TOP_SAMPLE_OFFSET;
            const blockersAtTop = getBlockerHeight(this.el, midX, ySample);
            obstructed = blockersAtTop > 0;
        }

        return {topHidden, bottomHidden, obstructed};
    }

    /**
     * Calculates target scroll position for element visibility.
     *
     * @private
     * @param {DOMRect} rect - Element bounding rectangle
     * @param {number} headerHeight - Combined height of blocking headers
     * @param {number} scrollY - Current scroll position
     * @param {boolean} topHidden - Whether top is hidden
     * @param {boolean} bottomHidden - Whether bottom is hidden
     * @returns {number} Target scroll Y position
     */
    _calculateScrollTarget(rect, headerHeight, scrollY, topHidden, bottomHidden) {
        if (topHidden) {
            // Bring top edge just below headers
            return scrollY + rect.top - headerHeight - this.extraOffset;
        }

        if (bottomHidden) {
            // Bring bottom edge into view
            return scrollY + (rect.bottom - window.innerHeight) + this.extraOffset;
        }

        // Obstructed case: treat as topHidden
        return scrollY + rect.top - headerHeight - this.extraOffset;
    }

    /**
     * Scrolls element into view if hidden or obstructed.
     * Does nothing if element is fully visible and unobstructed.
     * Uses requestAnimationFrame to avoid layout thrashing.
     *
     * Visibility logic:
     * 1. Detect stacked fixed headers at top
     * 2. Check if top/bottom edges are outside viewport
     * 3. Check if visible area is obstructed by other elements
     * 4. Scroll to bring element into view with minimal movement
     *
     * @public
     * @throws {Error} If element is no longer in DOM
     *
     * @example
     * // Scroll element into view if needed
     * scroller.ensureVisible();
     *
     * @example
     * // In keyboard navigation handler
     * document.addEventListener('keydown', (e) => {
     *   if (e.key === 'ArrowDown') {
     *     nextElement && new ViewportScroller(nextElement).ensureVisible();
     *   }
     * });
     */
    ensureVisible() {
        if (!this.el.isConnected) {
            logger.error(NAME, 'Element is no longer in DOM');
            return;
        }

        window.requestAnimationFrame(() => {
            const rect = this.el.getBoundingClientRect();
            const scrollY = window.scrollY;
            const midX = window.innerWidth / 2;

            // Discover all fixed headers stacked at viewport top
            const headerHeight = getBlockerHeight(this.el, midX, TOP_SAMPLE_OFFSET);

            // Check visibility state
            const {topHidden, bottomHidden, obstructed} = this._checkVisibility(rect, headerHeight);

            // Exit early if fully visible and unobstructed
            if (!topHidden && !bottomHidden && !obstructed) {
                return;
            }

            // Calculate minimal scroll needed
            const targetY = this._calculateScrollTarget(
                rect,
                headerHeight,
                scrollY,
                topHidden,
                bottomHidden
            );

            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: this.behavior
            });
        });
    }
}