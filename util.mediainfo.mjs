export const NAME = 'media-info';

/**
 * @fileoverview Media Info - Utility for querying CSS media features via JavaScript
 * @module util.medianifo
 * @version 1.0.0
 * @author hnldesign
 * @since 2025
 * @description
 * A small utility for querying CSS media features via JavaScript.
 * Wraps `window.matchMedia` to provide a simple function interface,
 * including sensible defaults for “boolean”-style features like
 * `prefers-reduced-motion`.
 * by hnldesign / Klaas Leussink @ 5-2025
 *
 * @example
 * import mediaInfo from './helper.media-info.mjs';
 *
 * // true if user prefers reduced motion (defaults to "reduce")
 * if (mediaInfo('prefers-reduced-motion')) {
 *   // disable or simplify animations
 * }
 *
 * // true if user prefers high contrast
 * if (mediaInfo('prefers-contrast', 'high')) {
 *   // boost UI contrast
 * }
 *
 * // true if user prefers dark color scheme
 * if (mediaInfo('prefers-color-scheme', 'dark')) {
 *   // switch to dark theme
 * }
 */

const _defaults = {
    'prefers-reduced-motion': 'reduce',
};

/**
 * Query a CSS media feature.
 *
 * @param {string} feature - The CSS media feature name, e.g. `"prefers-reduced-motion"`.
 * @param {string} [value] - The feature value to match against, e.g. `"reduce"`, `"dark"`, `"high"`.
 *                           If omitted and a default is configured (see `_defaults`), that default
 *                           will be used; otherwise, the function warns and returns false.
 * @throws {TypeError} If `feature` is not a string.
 * @returns {boolean} `true` if the media query `(${feature}: ${value})` matches; `false` otherwise
 *                    (including when `window.matchMedia` is unavailable).
 */
export default function mediaInfo(feature, value) {
    if (typeof feature !== 'string') {
        throw new TypeError('mediaInfo: first argument must be a media-feature string');
    }

    // pick up default value if none supplied
    let val = value;
    if (val === undefined) {
        if (feature in _defaults) {
            val = _defaults[feature];
        } else {
            console.warn(
                `mediaInfo: no default for "${feature}", please call mediaInfo('${feature}', value)`
            );
            return false;
        }
    }

    // no support → assume “no”
    if (typeof window === 'undefined' || !('matchMedia' in window)) {
        return false;
    }

    // construct and test the query
    const mq = `(${feature}: ${val})`;
    return window.matchMedia(mq).matches;
}
