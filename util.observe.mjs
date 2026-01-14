/**
 * @fileoverview Visibility and Obstruction Detection - Utilities for viewport and element visibility
 * @module util.observe
 * @version 3.1.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides visibility detection using both legacy getBoundingClientRect and modern
 * IntersectionObserver/ResizeObserver APIs. Includes obstruction checking via
 * elementFromPoint sampling.
 *
 * Browser Support:
 * - isVisible: All browsers with ES6 modules
 * - isVisibleNow: Chrome 51+, Safari 12.1+, Firefox 55+, Edge 15+
 * - isResizedNow: Chrome 64+, Safari 13.1+, Firefox 69+, Edge 79+
 * - isUnobstructed: All browsers with elementFromPoint (universal)
 * - getBlockerHeight: All browsers with elementsFromPoint (Chrome 43+, Safari 11.1+)
 */

import {logger} from './core.log.mjs';

export const NAME = 'observe';

// ============================================================================
// CONSTANTS
// ============================================================================

/** @private */
const DEFAULT_ROOT_MARGIN = '0px';

/** @private */
const DEFAULT_THRESHOLD = [0, 1];

// ============================================================================
// LEGACY VISIBILITY DETECTION
// ============================================================================

/**
 * Checks if element is visible in viewport using getBoundingClientRect.
 * Legacy method for compatibility with all browsers. Recalculates viewport
 * on every call for 100% accuracy.
 *
 * @param {Element} element - Element to check visibility
 * @param {Function} callback - Called with (visible, fullyVisible, rect)
 *   - visible: Element intersects viewport
 *   - fullyVisible: Element entirely within viewport
 *   - rect: Extended DOMRect with pageX/pageY properties
 * @param {Object} [vp={}] - Custom viewport boundaries
 * @param {number} [vp.top=0] - Viewport top offset (e.g., fixed header height)
 * @param {number} [vp.bottom=window.innerHeight] - Viewport bottom boundary
 * @param {number} [vp.left=0] - Viewport left offset
 * @param {number} [vp.right=window.innerWidth] - Viewport right boundary
 *
 * @throws {TypeError} If element is not a valid DOM Element
 *
 * @example
 * // Basic usage
 * isVisible(element, (visible, fullyVisible) => {
 *   if (visible) console.log('In viewport');
 * });
 *
 * @example
 * // Account for fixed header
 * isVisible(element, (visible) => {
 *   element.classList.toggle('active', visible);
 * }, { top: 80 });
 *
 * @example
 * // Custom viewport (e.g., modal container)
 * isVisible(element, (visible, fullyVisible, rect) => {
 *   console.log('Page Y:', rect.pageY);
 * }, { top: 100, bottom: 500 });
 */
export function isVisible(element, callback, vp = {}) {
    if (!(element instanceof Element)) {
        throw new TypeError('Not a valid node');
    }

    if (typeof element.getBoundingClientRect !== 'function') {
        logger.error(NAME, 'Element lacks getBoundingClientRect method', element);
        return;
    }

    const rect = element.getBoundingClientRect();

    // Calculate absolute page coordinates
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const clientTop = document.documentElement.clientTop;
    const clientLeft = document.documentElement.clientLeft;

    rect.pageY = rect.top + scrollTop - clientTop;
    rect.pageX = rect.left + scrollLeft - clientLeft;

    // Construct viewport boundaries (recalculated for accuracy)
    const viewport = {
        top: typeof vp.top !== 'undefined' ? vp.top : 0,
        bottom: typeof vp.bottom !== 'undefined' ? vp.bottom : (window.innerHeight || document.documentElement.clientHeight),
        left: typeof vp.left !== 'undefined' ? vp.left : 0,
        right: typeof vp.right !== 'undefined' ? vp.right : (window.innerWidth || document.documentElement.clientWidth),
    };

    // Check visibility states
    const hasSize = rect.height > 0 || rect.width > 0;
    const fullyVisible = hasSize && isFullyWithinViewport(rect, viewport);
    const visible = hasSize && isPartiallyInViewport(rect, viewport);

    if (typeof callback === 'function') {
        callback.call(this, visible, fullyVisible, rect);
    }
}

/**
 * Checks if rect is entirely within viewport boundaries.
 * @private
 * @param {DOMRect} rect - Element bounding rectangle
 * @param {Object} viewport - Viewport boundaries
 * @returns {boolean} True if fully visible
 */
function isFullyWithinViewport(rect, viewport) {
    return rect.bottom < viewport.bottom &&
        rect.right < viewport.right &&
        rect.top > viewport.top &&
        rect.left > viewport.left;
}

/**
 * Checks if rect partially intersects viewport.
 * @private
 * @param {DOMRect} rect - Element bounding rectangle
 * @param {Object} viewport - Viewport boundaries
 * @returns {boolean} True if any part is visible
 */
function isPartiallyInViewport(rect, viewport) {
    const verticallyVisible = rect.bottom >= 0 && rect.top <= viewport.bottom;
    // Fixed: handles elements wider than viewport (spanning entire viewport)
    const horizontallyVisible = rect.right > viewport.left && rect.left < viewport.right;
    return verticallyVisible && horizontallyVisible;
}

// ============================================================================
// MODERN INTERSECTION OBSERVER
// ============================================================================

/**
 * Modern visibility detection using IntersectionObserver API.
 * More efficient than isVisible for continuous monitoring.
 *
 * Browser Support: Chrome 51+, Safari 12.1+, Firefox 55+, Edge 15+
 *
 * @param {Element} element - Element to observe
 * @param {Function} callback - Called with (visible, fullyVisible, entry)
 *   - visible: Element intersects viewport (and unobstructed if checked)
 *   - fullyVisible: Element entirely within viewport
 *   - entry: IntersectionObserverEntry object
 * @param {Object} [options={}] - Observer configuration
 * @param {string} [options.rootMargin='0px'] - Margin around viewport (e.g., '50px')
 * @param {number[]} [options.threshold=[0,1]] - Intersection ratios to trigger callback
 * @param {boolean} [options.checkObstructions=false] - Verify unobstructed pixels via sampling
 *
 * @returns {IntersectionObserver} Observer instance (call .disconnect() to cleanup)
 *
 * @throws {TypeError} If element is not a valid DOM Element
 *
 * @example
 * // Basic lazy loading
 * const observer = isVisibleNow(image, (visible) => {
 *   if (visible) {
 *     image.src = image.dataset.src;
 *     observer.disconnect();
 *   }
 * });
 *
 * @example
 * // Preload 50px before entering viewport
 * isVisibleNow(element, (visible) => {
 *   console.log('Near viewport');
 * }, { rootMargin: '50px' });
 *
 * @example
 * // Check if element is obstructed by overlays
 * isVisibleNow(element, (visible) => {
 *   if (visible) console.log('Visible AND unobstructed');
 * }, { checkObstructions: true });
 */
export function isVisibleNow(element, callback, options = {}) {
    const {
        rootMargin = DEFAULT_ROOT_MARGIN,
        threshold = DEFAULT_THRESHOLD,
        checkObstructions = false
    } = options;

    if (!(element instanceof Element)) {
        throw new TypeError('Not a valid node');
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const inViewport = entry.intersectionRatio > 0;
            const fullyVisible = entry.intersectionRatio === 1;

            // Additional obstruction check if requested
            let visible = inViewport;
            if (inViewport && checkObstructions) {
                visible = isUnobstructed(element);
            }

            if (typeof callback === 'function') {
                callback(visible, fullyVisible, entry);
            }
        });
    }, { rootMargin, threshold });

    observer.observe(element);

    return observer;
}

// ============================================================================
// RESIZE OBSERVER
// ============================================================================

/**
 * Monitors element dimension changes using ResizeObserver API.
 *
 * Browser Support: Chrome 64+, Safari 13.1+, Firefox 69+, Edge 79+
 *
 * @param {Element} element - Element to observe
 * @param {Function} callback - Called with ResizeObserverEntry on dimension change
 *
 * @returns {Function} Cleanup function to unobserve and disconnect
 *
 * @example
 * // Monitor container size
 * const cleanup = isResizedNow(container, (entry) => {
 *   console.log('New size:', entry.contentRect.width);
 * });
 *
 * // Later: cleanup when no longer needed
 * cleanup();
 *
 * @example
 * // Track aspect ratio changes
 * isResizedNow(video, (entry) => {
 *   const ratio = entry.contentRect.width / entry.contentRect.height;
 *   video.classList.toggle('portrait', ratio < 1);
 * });
 */
export function isResizedNow(element, callback) {
    if (typeof ResizeObserver !== 'function') {
        logger.warn(NAME, 'ResizeObserver not supported in this browser');
        return () => {};
    }

    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            callback(entry);
        }
    });

    resizeObserver.observe(element);

    // Return cleanup function
    return () => {
        resizeObserver.unobserve(element);
        resizeObserver.disconnect();
    };
}

// ============================================================================
// OBSTRUCTION DETECTION
// ============================================================================

/**
 * Detects if element's visible area is obstructed by other elements.
 * Uses elementFromPoint sampling at strategic coordinates (corners + center).
 *
 * Algorithm:
 * 1. Sample top-left, top-right, top-center, and center points
 * 2. Check if hit element is self, child, or parent (unobstructed)
 * 3. Returns true if ANY sample point is unobstructed
 *
 * @param {Element} element - Element to check for obstruction
 * @returns {boolean} True if at least one sampled point is unobstructed
 *
 * @example
 * // Check if modal is actually visible (not behind overlay)
 * if (isUnobstructed(modal)) {
 *   modal.focus();
 * }
 *
 * @example
 * // Verify lazy-loaded element rendered properly
 * isVisibleNow(element, (visible) => {
 *   if (visible && isUnobstructed(element)) {
 *     trackImpression(element);
 *   }
 * });
 */
export function isUnobstructed(element) {
    const { left, top, right, bottom } = element.getBoundingClientRect();

    // Sample strategic points (avoid exact edges which may miss borders)
    const samples = [
        [left + 1, top + 1],           // Top-left
        [right - 1, top + 1],          // Top-right
        [(left + right) / 2, top + 1], // Top-center
        [(left + right) / 2, (top + bottom) / 2] // Center
    ];

    return samples.some(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return (
            hit === element ||        // Hit self
            element.contains(hit) ||  // Hit child
            hit?.contains(element)    // Hit parent
        );
    });
}

/**
 * Measures cumulative height of stacked blocking elements from top of viewport.
 * Scans vertically from startY, accumulating heights of elements that block
 * the target element.
 *
 * Algorithm:
 * 1. Start scan at (x, startY)
 * 2. Get all elements at scan point via elementsFromPoint
 * 3. Find first "blocker" (not el, not child, not parent)
 * 4. If blocker found and extends below current height:
 *    - Update headerHeight to blocker's bottom edge
 *    - Move scan point below blocker
 *    - Repeat
 * 5. Stop when no blocker found or blocker doesn't extend height
 *
 * Typical use: Measure fixed header stack for scroll-to positioning.
 *
 * Browser Support: Chrome 43+, Safari 11.1+, Firefox 46+, Edge 12+
 *
 * @param {Element} el - Element to exclude from blocking calculations
 * @param {number} x - Horizontal sample coordinate (typically viewport center)
 * @param {number} [startY=1] - Vertical start position in pixels
 * @returns {number} Total height of blocking elements (bottom edge of lowest blocker)
 *
 * @example
 * // Measure fixed header height for scroll positioning
 * const headerHeight = getBlockerHeight(targetElement, window.innerWidth / 2);
 * window.scrollTo({
 *   top: targetElement.offsetTop - headerHeight,
 *   behavior: 'smooth'
 * });
 *
 * @example
 * // Find obstruction over specific element
 * const blocker = getBlockerHeight(
 *   element,
 *   element.getBoundingClientRect().left + element.offsetWidth / 2
 * );
 * console.log('Blocked by', blocker, 'px');
 */
export function getBlockerHeight(el, x, startY = 1) {
    let headerHeight = 0;
    let scanY = startY;

    while (true) {
        // Get all elements at scan point (z-order: front to back)
        const hits = document.elementsFromPoint(x, scanY);

        // Find first element that blocks our target
        const blocker = hits.find(element =>
            element !== el &&
            !el.contains(element) &&
            !element.contains(el)
        );

        if (!blocker) break;

        const bottom = blocker.getBoundingClientRect().bottom;

        // If blocker doesn't extend our known height, we're done
        if (bottom <= headerHeight) break;

        // Update height and continue scan below this blocker
        headerHeight = bottom;
        scanY = Math.ceil(headerHeight + 1);
    }

    return headerHeight;
}