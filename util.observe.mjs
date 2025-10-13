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

/**
 * Modern visibility detection with optional obstruction checking.
 *
 * @param {Element} element - Element to observe
 * @param {Function} callback - Called with (visible, fullyVisible, entry)
 * @param {Object} [options]
 * @param {string} [options.rootMargin='0px'] - IntersectionObserver margin
 * @param {number[]} [options.threshold=[0,1]] - Visibility thresholds
 * @param {boolean} [options.checkObstructions=false] - Verify unobstructed pixels
 * @returns {IntersectionObserver} Observer instance for cleanup
 */
export function isVisibleNow(element, callback, options = {}) {
    const {
        rootMargin = '0px',
        threshold = [0, 1],
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

/**
 * Detects if element's visible area is obstructed by other elements.
 * Samples top edge (left/center/right) and center point.
 *
 * @param {Element} element - Element to check
 * @returns {boolean} True if unobstructed (visible pixels exist)
 */
export function isUnobstructed(element) {
    const { left, top, right, bottom } = element.getBoundingClientRect();
    const samples = [
        [left + 1, top + 1],
        [right - 1, top + 1],
        [(left + right) / 2, top + 1],
        [(left + right) / 2, (top + bottom) / 2]
    ];
    return samples.some(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return (
            hit === element ||
            element.contains(hit) ||
            hit?.contains(element)
        );
    });
}

/**
 * Measures cumulative height of stacked blocking elements from top of viewport.
 * Used to detect fixed headers/overlays that obscure content.
 *
 * @param {number} x - Horizontal sample coordinate
 * @param {number} startY - Vertical start position (default 1)
 * @returns {number} Bottom edge of lowest blocker in pixels
 */
export function getBlockerHeight(el, x, startY = 1) {
    let headerHeight = 0;
    let scanY = startY;

    while (true) {
        // get every element whose box covers (x, scanY), in z‐order
        const hits = document.elementsFromPoint(x, scanY);
        // find the first one that truly “blocks” us
        const blocker = hits.find(element =>
            element !== el &&
            !el.contains(element) &&
            !element.contains(el)
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