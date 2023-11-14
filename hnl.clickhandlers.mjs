/**
 * Clickhandlers, for double click, etc.
 */

export const NAME = 'clickHandlers';

export function doubleClick(target, callback) {
    if (typeof callback === 'function' && target) {
        target.addEventListener('click', (event)=>{
            if (new Date().getTime() - (target._lastTouch || 0) > 500) {
                // Not a double click
                target._lastTouch = new Date().getTime();
            } else {
                // A double click
                callback.call(this, event, target);
            }
        });
    }
    //return for chaining
    return clickHandler;
}
export function singleClick(target, callback) {
    if (typeof callback === 'function' && target) {
        target.addEventListener('click', (event)=>{
            // A single click
            callback.call(this, event, target);
        })
    }
    //return for chaining
    return clickHandler;
}

export const clickHandler = {
    doubleClick, singleClick
}