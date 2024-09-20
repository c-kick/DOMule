/**
 * Clickhandlers, for double click, etc.
 *
 * Avoids polluting the global namespace if defined as prototype functions. Usage:
 * import {doubleClick, singleClick} from "hnl.clickhandlers.mjs";
 *
 * doubleClick(myClickableElement, (event, element)=>{
 *     //do stuff
 * });
 *
 */

export const NAME = 'clickHandlers';


function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

export function doubleClick(target, callback, once = false) {
    if (typeof callback === 'function' && target) {
        const threshold = 500;
        let lastTouchTime = 0;

        const handler = (event) => {
            const currentTime = new Date().getTime();

            if (currentTime - lastTouchTime > threshold) {
                // Not a double click
                lastTouchTime = currentTime;
            } else {
                // A double click
                callback.call(this, event, target);
            }
        };

        if ("onpointerup" in window) {
            target.addEventListener('pointerup', handler, {once: once});
        } else if (isTouchDevice()) {
            target.addEventListener('touchstart', handler, {once: once});
        } else {
            target.addEventListener('click', handler, {once: once});
        }
    }

    // Return for chaining
    return clickHandlers;
}

export function singleClick(target, callback, once = false) {
    if (typeof callback === 'function' && target) {
        const handler = (event) => {
            // A single click
            callback.call(this, event, target);
        };

        if ("onpointerup" in window) {
            target.addEventListener('pointerup', handler, {once: once});
        } else if (isTouchDevice()) {
            target.addEventListener('touchend', handler, {once: once});
        } else {
            target.addEventListener('click', handler, {once: once});
        }
    }

    // Return for chaining
    return clickHandlers;
}

/**
 * Adds a click handler to a specified parent element that toggles a class on a target element within.
 * Clicks outside the target element can optionally be handled to remove the class.
 * If clicks outside are to be handled, the listener is attached to `document.body` and
 * toggles the class only for elements within the original parent element.
 *
 * @param {Element} parentElement - The parent element to attach the click handler or document.body if handleClicksOutside is true.
 * @param {string} [className='active'] - The class name to toggle on the target element.
 * @param {string} [onElement='.row'] - The selector for the target element to toggle the class on.
 * @param {boolean} [handleClicksOutside=true] - Whether clicks outside the target element should remove the class.
 * @param {boolean} [unsetOnSecondClick=false] - Whether a click on an already active element will unset it again
 * @returns {boolean} - Returns false if a click handler was already attached, otherwise undefined.
 */
export function addClickHandler(parentElement, className = 'active', onElement = '.row', handleClicksOutside = true, unsetOnSecondClick = false) {
    // Early return if a click handler has already been attached
    if (parentElement.dataset.clickhandler === 'attached') return false;

    // Determine the effective parent for attaching the event listener
    const effectiveParent = handleClicksOutside ? document.body : parentElement;

    // Variable to keep track of the last active element
    let lastActive = null;

    // Attach click event listener
    effectiveParent.addEventListener('click', e => {
        const targetElement = e.target.closest(onElement);
        const isClickInsideTarget = targetElement && parentElement.contains(targetElement);

        // Toggle the class if the click was on the target element within the parentElement
        if (isClickInsideTarget) {
            // If unsetOnSecondClick is false and the target is already active, do nothing
            if (!unsetOnSecondClick && targetElement.classList.contains(className)) {
                return;
            }
            // Remove the class from the last active element if it's different from the current target
            if (lastActive && lastActive !== targetElement) {
                lastActive.classList.remove(className);
            }
            // Toggle the class on the target element
            targetElement.classList.toggle(className);
            // Update the last active element reference
            lastActive = targetElement.classList.contains(className) ? targetElement : null;
        } else if (!isClickInsideTarget && lastActive) {
            // Handle clicks outside the target element
            lastActive.classList.remove(className);
            lastActive = null;
        }
    });

    // Mark the parent element to prevent attaching duplicate handlers
    effectiveParent.dataset.clickhandler = 'attached';
}

const clickHandlers = {
    doubleClick,
    singleClick
};