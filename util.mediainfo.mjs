export const NAME = 'media-info';

/**
 * @fileoverview Media Info - Utility for querying CSS media features via JavaScript
 * @module util.mediainfo
 * @version 1.1.0
 * @author hnldesign
 * @since 2025
 *
 * @description
 * Wraps window.matchMedia to provide a simple function interface for CSS media queries.
 * Includes sensible defaults for boolean-style features and memoization for performance.
 *
 * @example
 * import mediaInfo from './util.mediainfo.mjs';
 *
 * // User prefers reduced motion (defaults to "reduce")
 * if (mediaInfo('prefers-reduced-motion')) {
 *   disableAnimations();
 * }
 *
 * // User prefers dark color scheme
 * if (mediaInfo('prefers-color-scheme', 'dark')) {
 *   applyDarkTheme();
 * }
 */

/**
 * Default values for boolean-style media features.
 * @private
 * @type {Object<string, string>}
 */
const DEFAULTS = {
    'prefers-reduced-motion': 'reduce',
    'prefers-color-scheme': 'dark',
    'prefers-contrast': 'high'
};

/**
 * Cache for memoized media query results.
 * @private
 * @type {Map<string, boolean>}
 */
const queryCache = new Map();

/**
 * Query a CSS media feature with memoization.
 *
 * @param {string} feature - CSS media feature name (e.g., "prefers-reduced-motion")
 * @param {string} [value] - Feature value to match (e.g., "reduce", "dark", "high")
 *                           Uses default if omitted and feature has a default
 * @throws {TypeError} If feature is not a string
 * @returns {boolean} True if media query matches, false otherwise
 *
 * @example
 * // Check with explicit value
 * mediaInfo('prefers-contrast', 'high'); // → true/false
 *
 * @example
 * // Use default value
 * mediaInfo('prefers-reduced-motion'); // → true if user prefers reduced motion
 */
export default function mediaInfo(feature, value) {
    if (typeof feature !== 'string') {
        throw new TypeError(`mediaInfo: feature must be a string, got ${typeof feature}`);
    }

    // Resolve value (explicit or default)
    const val = value !== undefined ? value : DEFAULTS[feature];

    if (val === undefined) {
        console.warn(
            `mediaInfo: no value or default for "${feature}". ` +
            `Call mediaInfo('${feature}', value) or add to DEFAULTS.`
        );
        return false;
    }

    // Check cache
    const cacheKey = `${feature}:${val}`;
    if (queryCache.has(cacheKey)) {
        return queryCache.get(cacheKey);
    }

    // No matchMedia support
    if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
    }

    // Execute query and cache
    const mq = `(${feature}: ${val})`;
    const result = window.matchMedia(mq).matches;
    queryCache.set(cacheKey, result);

    return result;
}

/**
 * Clear memoization cache (useful when media features change).
 * @public
 */
export function clearMediaCache() {
    queryCache.clear();
}
