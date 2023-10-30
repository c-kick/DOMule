/**
 * Clickhandlers, for double click, etc.
 */

export const NAME = 'clickHandlers';

export function doubleClick(target, callback) {
    if (typeof callback === 'function' && target) {
        target.addEventListener('click', ()=>{
            if (new Date().getTime() - (target._lastTouch || 0) > 500) {
                // Not a double click
                target._lastTouch = new Date().getTime();
            } else {
                // A double click
                callback.call(this);
            }
        });
    }
    //return for chaining
    return clickHandler;
}

export const clickHandler = {
    doubleClick
}