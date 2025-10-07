/**
 * @fileoverview Fancy Console Logger - Color-coded module logging system
 * @module core.log
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides structured, color-coded console logging for module events.
 * Only outputs when ?debug=true is present in URL. Automatically generates
 * consistent colors per module name for easy visual tracking.
 *
 * Features:
 * - Debug flag detection (?debug=true in URL)
 * - Per-module color consistency using color generation
 * - Structured message formatting with CSS styling
 * - Log level support (log, info, warn, error)
 * - Object/array pretty-printing
 *
 * @example
 * import {logger} from './core.log.mjs';
 *
 * // Basic logging
 * logger.log('myModule', 'Initialized');
 *
 * // With objects
 * logger.info('myModule', {count: 5, status: 'ready'});
 *
 * // Error logging
 * logger.error('myModule', 'Failed to load');
 */

import ColorTool from "./util.color.mjs";

export const NAME = 'logger';

/**
 * Debug mode enabled flag.
 * Only logs when ?debug=true is present in URL.
 * @type {boolean}
 * @private
 */
const ENABLED = window.location.search.includes('debug=true');

/**
 * Base CSS for message styling.
 * @type {string}
 * @private
 */
const message_css = `font-family: Lucida Grande,Lucida Sans Unicode,Lucida Sans,Geneva,Verdana,sans-serif`;

/**
 * Process message arguments into CSS-formatted string.
 * Converts array-like arguments into %c-prefixed string for console styling.
 * @private
 * @param {IArguments} message - Arguments object from logging function
 * @returns {string} Formatted message string with %c placeholders
 */
function _processMessage(message) {
    return '%c' + [].slice.call(message).join('%c');
}

/**
 * Generate consistent CSS styling for module name badge.
 * Uses ColorTool to create deterministic color from module name string.
 * @private
 * @param {string} input - Module name
 * @returns {string} CSS string for console styling
 *
 * @example
 * _logColor('myModule')
 * // Returns: "color:#fff; background-color:rgb(...); padding:3px 5px;..."
 */
function _logColor(input) {
    const colorBase = ColorTool.new(input);
    return `color:${colorBase.contra};
  background-color:${colorBase.string};
  background-image:linear-gradient(0deg,${colorBase.adjust({deg: 10}).string} 0%, ${colorBase.adjust({opa: 1}).string} 100%);
  padding:3px 5px;margin-right:15px;border-radius:4px;`;
}

/**
 * Fancy console logger for module events.
 * Provides color-coded, structured output with automatic module identification.
 * Only logs when debug mode is enabled (?debug=true).
 *
 * @namespace
 * @type {Object}
 *
 * @example
 * // Enable debug mode
 * // https://yoursite.com/page.html?debug=true
 *
 * import {logger} from './core.log.mjs';
 *
 * logger.log('myModule', 'Started');
 * // Output: [myModule] Started (with colored badge)
 *
 * logger.info('myModule', {count: 5});
 * // Output: [myModule] {count: 5} (blue text, colored badge)
 *
 * logger.warn('myModule', 'Deprecated feature');
 * // Output: [myModule] Deprecated feature (orange text, colored badge)
 *
 * logger.error('myModule', 'Failed');
 * // Output: [myModule] Failed (red text, colored badge)
 */
export const hnlLogger = {
    /**
     * Log informational message.
     * @param {string} type - Module name (generates consistent color badge)
     * @param {*} message - Message string or object to log
     *
     * @example
     * logger.log('myModule', 'Operation completed');
     * logger.log('myModule', {result: true, time: 150});
     */
    log: function (type, message) {
        ENABLED ? console.log((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:black;`
        ) : true;
    },

    /**
     * Log info-level message with blue text.
     * @param {string} type - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.info('myModule', 'Configuration loaded');
     */
    info: function (type, message) {
        ENABLED ? console.info((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:#1e529e;`
        ) : true;
    },

    /**
     * Log warning message with orange text.
     * @param {string} type - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.warn('myModule', 'Feature deprecated, use X instead');
     */
    warn: function (type, message) {
        ENABLED ? console.warn((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:#fd7e14;`
        ) : true;
    },

    /**
     * Log error message with red text.
     * @param {string} type - Module name
     * @param {*} message - Message string or object
     *
     * @example
     * logger.error('myModule', 'Failed to initialize');
     * logger.error('myModule', new Error('Network timeout'));
     */
    error: function (type, message) {
        ENABLED ? console.error((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:red;`
        ) : true;
    },
}

/**
 * Alias for hnlLogger (v3.0 API).
 * @type {Object}
 */
export const logger = hnlLogger;