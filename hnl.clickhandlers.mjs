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

export function doubleClick(target, callback) {
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
        }

        if (isTouchDevice()) {
            target.addEventListener('touchstart', handler);
        } else {
            target.addEventListener('click', handler);
        }
    }

    // Return for chaining
    return clickHandlers;
}

export function singleClick(target, callback) {
    if (typeof callback === 'function' && target) {
        const handler = (event) => {
            // A single click
            callback.call(this, event, target);
        }

        if (isTouchDevice()) {
            target.addEventListener('touchend', handler);
        } else {
            target.addEventListener('click', handler);
        }
    }

    // Return for chaining
    return clickHandlers;
}

const clickHandlers = {
    doubleClick,
    singleClick
};