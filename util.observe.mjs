export const NAME = 'observe';

export function isVisible(element, callback, vp = {}) {
    if (!(element instanceof Element)) {
        throw new TypeError('Not a valid node');
    }
    if (typeof element.getBoundingClientRect === 'function') {

        const rect = element.getBoundingClientRect();

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const clientTop = document.documentElement.clientTop;
        const clientLeft = document.documentElement.clientLeft;

        rect.pageY = rect.top + scrollTop - clientTop;
        rect.pageX = rect.left + scrollLeft - clientLeft;

        const viewport = {
            top: typeof vp.top !== 'undefined' ? vp.top : 0,
            bottom: typeof vp.bottom !== 'undefined' ? vp.bottom : window.innerHeight || document.documentElement.clientHeight,
            left: typeof vp.left !== 'undefined' ? vp.left : 0,
            right: typeof vp.right !== 'undefined' ? vp.right : window.innerWidth || document.documentElement.clientWidth,
        };

        const fullyVisible = (
            (rect.height > 0 || rect.width > 0) &&
            rect.bottom < viewport.bottom &&
            rect.right < viewport.right &&
            rect.top > viewport.top &&
            rect.left > viewport.left
        );

        const visible = (
            (rect.height > 0 || rect.width > 0) &&
            rect.bottom >= 0 &&
            rect.top <= viewport.bottom &&
            ((rect.right > viewport.left && rect.right <= viewport.right) || (rect.left < viewport.right && rect.left >= viewport.left))
        )

        if (typeof callback === 'function') {
            callback.call(this, visible, fullyVisible, rect);
        }

    } else {
        console.error('Can\'t check visibility for', typeof this, this);
    }
}

export function isVisibleNow(element, callback, options = {}) {
    const { rootMargin = '0px', threshold = [0, 1] } = options;

    if (!(element instanceof Element)) {
        throw new TypeError('Not a valid node');
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const visible = entry.intersectionRatio > 0;
            const fullyVisible = entry.intersectionRatio === 1;

            if (typeof callback === 'function') {
                callback(visible, fullyVisible, entry);
            }
        });
    }, { rootMargin, threshold });

    observer.observe(element);

    // Returns observer so it can be disconnected later if needed
    return observer;
}

export function isResizedNow(element, callback) {
    // Check if ResizeObserver is supported
    if (typeof ResizeObserver !== 'function') {
        console.warn('ResizeObserver is not supported in this browser.');
        return;
    }

    // Create a new ResizeObserver instance
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // Invoke the callback with the entry
            callback(entry);
        }
    });

    // Start observing the specified element
    resizeObserver.observe(element);

    // Provide a way to stop observing
    return () => {
        resizeObserver.unobserve(element);
        resizeObserver.disconnect();
    };
}

export async function watchVisibility(element, callback = null, disconnectWhenVisible = false) {
    //step 1: monitor changes in visibility
    const visibilityObserver = isVisibleNow(element, (isVisible, isFullyVisible, visData)=>{
        element.dataset.visible = isVisible;
        element.dataset.fullyVisible = isFullyVisible;
        //step 2: set up resize check
        const resizeObserver = isResizedNow(element, (resData) => {
            if (typeof callback === 'function') {
                callback.call(this, isVisible, isFullyVisible, {visibilityObserver, resizeObserver, visibility_data: visData, resize_data: resData});
                if (disconnectWhenVisible && isFullyVisible) {
                    visibilityObserver.disconnect();
                }
            }
        });
    });
}