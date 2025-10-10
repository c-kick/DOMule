/**
 * @fileoverview Baseline Grid System - Dynamic typographic baseline grid implementation
 *
 * This module provides a JavaScript-driven baseline grid system that automatically
 * adjusts element heights to maintain consistent vertical rhythm in typography layouts.
 * Elements within baseline grid containers are dynamically resized to align with
 * multiples of the parent container's line-height value.
 *
 * The system targets block-level elements (images, divs, etc.) while preserving
 * natural text flow for inline and text elements. Special handling is provided
 * for images that require load completion before dimension calculations.
 *
 * @version 2.0.0
 * @author hnldesign
 * @since 2022
 * @requires hnl.debounce.mjs - Provides debouncedEvent utility
 *
 * @example
 * // Basic usage - initialize baseline grid on page load
 * import { init } from './baseline-grid-demo.mjs';
 * init(document.querySelectorAll('.baseline-grid'));
 *
 * @example
 * // HTML structure required
 * <div class="baseline-grid">
 *   <p>This text flows naturally</p>
 *   <img class="conform-block-to-baseline" src="..." alt="...">
 *   <div class="conform-block-to-baseline">Block content</div>
 * </div>
 */

import {debouncedEvent} from "./hnl.debounce.mjs";
/**
 * Module identifier for baseline grid system
 * @constant {string}
 */
export const NAME = 'baseline-grid';

/**
 * Calculates and applies baseline-aligned height to a single element.
 *
 * This function measures the natural height of an element, determines the
 * parent container's line-height (baseline unit), and sets a CSS custom
 * property with the height rounded to the nearest baseline multiple.
 *
 * The calculation uses requestAnimationFrame to ensure accurate measurements
 * after any pending layout changes have been applied.
 *
 * @param {HTMLElement} el - The element to resize to baseline alignment
 *
 * @example
 * const img = document.querySelector('img.conform-block-to-baseline');
 * calcBlockHeight(img);
 * // Sets --grid-height CSS property to baseline-aligned value
 */
const calcBlockHeight = (el) => {
    el.style.setProperty('--grid-height', null);
    requestAnimationFrame(() => {
        const height = el.offsetHeight;
        const elStyle = window.getComputedStyle(el.parentNode);
        const gridSize = Math.round(parseFloat(elStyle.getPropertyValue('line-height')));
        el.style.setProperty('--grid-height', Math.round(Math.round(height / gridSize) * gridSize) + 'px'); //round off height to a multiple of grid size
    })
}

/**
 * Applies baseline grid alignment to multiple container elements and their children.
 *
 * Processes all eligible child elements within the specified containers, applying
 * baseline alignment calculations. Elements are filtered to exclude text-level
 * elements that should maintain natural text flow.
 *
 * Images receive special handling - calculations are deferred until image load
 * completion to ensure accurate dimension measurements.
 *
 * @param {NodeList|HTMLElement[]|string} els - Container elements or CSS selector
 *   - NodeList/Array: Direct collection of container elements
 *   - String: CSS selector for containers (e.g., '.baseline-grid')
 *
 * @example
 * // Process specific containers
 * const containers = document.querySelectorAll('.baseline-grid');
 * conformBlocksToBaseline(containers);
 *
 * @example
 * // Process by selector
 * conformBlocksToBaseline('.baseline-grid');
 */
const conformBlocksToBaseline = (els) => {
    els = (els instanceof Object) ? els : document.querySelectorAll(els);
    const skip = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'small', 'i', 'b', 'u', 'ol', 'ul']);
    els.forEach((el) => {

        // Get all descendants that are either direct children OR have specific classes OR node names
        const selector = ':scope > *, .conform-block-to-baseline';
        el.querySelectorAll(selector).forEach((adjustableChild) => {
            if (skip.has(adjustableChild.nodeName.toLowerCase())) return;
            if (adjustableChild.nodeName === 'IMG') {
                if (adjustableChild.complete) {
                    calcBlockHeight(adjustableChild);
                } else {
                    adjustableChild.onload = function () {
                        calcBlockHeight(this);
                    }
                }
            } else {
                calcBlockHeight(adjustableChild);
            }
        });
    })
}

/**
 * Initializes the baseline grid system with event handling and automatic updates.
 *
 * Sets up debounced event listeners for window resize and scroll events to
 * maintain baseline alignment when layout changes occur. Performs initial
 * baseline calculation on all specified elements.
 *
 * Event handlers are debounced to 100ms to prevent excessive recalculations
 * during rapid resize or scroll operations.
 *
 * @param {NodeList|HTMLElement[]|string} elements - Target containers for baseline grid
 *
 * @example
 * // Initialize on all baseline grid containers
 * init(document.querySelectorAll('.baseline-grid'));
 *
 * @example
 * // Initialize with selector
 * init('.baseline-grid');
 */
export function init(elements){
    debouncedEvent(window, 'resize', function () {
        conformBlocksToBaseline(elements);
    }, 100, false, true);

    debouncedEvent(window, 'scroll', function () {
        conformBlocksToBaseline(elements);
    }, 100, false, true);

    conformBlocksToBaseline(elements);

}