import {isUnobstructed, getBlockerHeight} from './util.observe.mjs';

export const NAME = 'ensure-visibility';
/**
 * @module helper/ensure-visibility
 * @description
 * A small utility to scroll an element into view only when necessary,
 * accounting for offscreen position, fixed headers, and top-edge obstructions.
 * by hnldesign / Klaas Leussink @ 5-2025
 *
 * @example
 * import { ViewportScroller } from './util.ensure-visibility.mjs';
 *
 * const element = document.querySelector('#target');
 * const scroller = new ViewportScroller(element, {
 *   behavior: 'smooth',   // 'auto' or 'smooth' scrolling
 *   extraOffset: 12       // additional gap (px) below any fixed header
 * });
 *
 * // When you need to ensure visibility:
 * scroller.ensureVisible();
 */
export class ViewportScroller {
    /**
     * @param {Element} el - The DOM element to manage visibility for.
     * @param {Object} [opts]
     * @param {'auto'|'smooth'} [opts.behavior='smooth'] - Scroll behavior.
     * @param {number} [opts.extraOffset=0] - Extra spacing (px) below headers.
     */
    constructor(el, opts = {}) {
        if (!(el instanceof Element)) {
            throw new TypeError('ViewportScroller: el must be a DOM Element');
        }
        const { behavior = 'smooth', extraOffset = 0 } = opts;
        this.el = el;
        this.behavior = behavior;
        this.extraOffset = extraOffset;
    }

    /**
     * Scrolls the element into view if its top or bottom edges are out of the viewport,
     * or if its top edge is hidden behind a fixed header or other obstruction.
     * @public
     */
    ensureVisible() {
        // Defer to the next frame to avoid layout thrashing
        window.requestAnimationFrame(() => {

            const rect    = this.el.getBoundingClientRect();
            const scrollY = window.scrollY;
            const midX    = window.innerWidth / 2;

            // 1) Discover *all* fixed headers stacked at the top:
            const headerHeight = getBlockerHeight(this.el, midX, /* startY= */1);

            // 2) Check whether top and bottom are in view
            const topHidden    = rect.top    < headerHeight + this.extraOffset;
            const bottomHidden = rect.bottom > window.innerHeight;

            // 3) Check for any other obstruction when the top is in view
            let obstructed = false;
            if (!topHidden && !bottomHidden) {
                // sample just below the top edge
                const ySample = rect.top + 1;
                const blockersAtTop = getBlockerHeight(this.el, midX, ySample);
                obstructed = blockersAtTop > 0;
            }

            // 4) If it’s fully visible & unobstructed, bail
            if (!topHidden && !bottomHidden && !obstructed) return;

            // 5) Compute your one scrollTarget
            let targetY = scrollY;
            if (topHidden) {
                targetY = scrollY + rect.top - headerHeight - this.extraOffset;
            } else if (bottomHidden) {
                targetY = scrollY + (rect.bottom - window.innerHeight) + this.extraOffset;
            }
            // Note: if it was only obstructed-in-view, 'topHidden' is false but
            // 'obstructed' true, so we fall through to the topHidden branch,
            // which brings the top edge just below the header stack.

            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: this.behavior
            });
        });
    }
}
