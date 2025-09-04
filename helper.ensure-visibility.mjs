/**
 * @module helper/ensure-visibility
 * @description
 * A small utility to scroll an element into view only when necessary,
 * accounting for offscreen position, fixed headers, and top-edge obstructions.
 * by hnldesign / Klaas Leussink @ 5-2025
 *
 * @example
 * import { ViewportScroller } from './helper.ensure-visibility.mjs';
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
     * Check a few sample points along the top edge and center to ensure
     * nothing opaque (other than ancestors or descendants) covers it.
     * @private
     * @returns {boolean}
     */
    _isUnobstructed() {
        const { left, top, right, bottom } = this.el.getBoundingClientRect();
        const samples = [
            [left + 1, top + 1],
            [right - 1, top + 1],
            [(left + right) / 2, top + 1],
            [(left + right) / 2, (top + bottom) / 2]
        ];
        return samples.every(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return (
                hit === this.el ||
                this.el.contains(hit) ||
                hit?.contains(this.el)
            );
        });
    }

    /**
     * @private
     * @param {number} x  Horizontal sample coordinate (e.g. window.innerWidth/2)
     * @param {number} startY  Vertical coordinate to start scanning (usually 1)
     * @returns {number}  The cumulative bottom‐edge (px) of all stacked blockers
     */
    _getCombinedBlockerHeight(x, startY = 1) {
        let headerHeight = 0;
        let scanY = startY;

        while (true) {
            // get every element whose box covers (x, scanY), in z‐order
            const hits = document.elementsFromPoint(x, scanY);
            // find the first one that truly “blocks” us
            const blocker = hits.find(el =>
                el !== this.el &&
                !this.el.contains(el) &&
                !el.contains(this.el)
            );
            if (!blocker) break;

            const bottom = blocker.getBoundingClientRect().bottom;
            // if it doesn’t extend our known headerHeight, we’re done
            if (bottom <= headerHeight) break;

            headerHeight = bottom;
            scanY = Math.ceil(headerHeight + 1);
        }

        return headerHeight;
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
            const headerHeight = this._getCombinedBlockerHeight(midX, /* startY= */1);

            // 2) Check whether top and bottom are in view
            const topHidden    = rect.top    < headerHeight + this.extraOffset;
            const bottomHidden = rect.bottom > window.innerHeight;

            // 3) Check for any other obstruction when the top is in view
            let obstructed = false;
            if (!topHidden && !bottomHidden) {
                // sample just below the top edge
                const ySample = rect.top + 1;
                const blockersAtTop = this._getCombinedBlockerHeight(midX, ySample);
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
