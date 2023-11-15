/**
 * URL tools
 */
/**
 * URL tools for managing and manipulating URL parameters.
 * @module urlTools
 */

import { hnlLogger } from "./hnl.logger.mjs";

/**
 * The name of the module.
 * @constant {string}
 */
export const NAME = 'urlTools';

/**
 * Change or remove a URL parameter.
 *
 * @param {string} key - The parameter key.
 * @param {any} value - The parameter value.
 * @param {boolean} [navigate=true] - Whether to navigate or not.
 */
export function changeUrlVar(key, value, navigate = true) {
  if ('URLSearchParams' in window) {
    const searchParams = new URLSearchParams(window.location.search);
    const setValue = (value === undefined) ? 'true' : ((typeof value === 'boolean' && !value) ? 'false' : value);

    if ((value === undefined || value === null) && searchParams.has(key)) {
      // Delete if key passed with no value, and key already exists in search parameters.
      searchParams.delete(key);
    } else if (value !== undefined && value !== null) {
      searchParams.set(key, setValue);
    }

    if (navigate) {
      window.location.search = searchParams.toString();
    } else {
      window.history.replaceState(window.history.state, "", window.location.pathname + '?' + searchParams.toString());
    }
  } else {
    hnlLogger.warn(NAME, 'Window has no search param support.');
  }
}

/**
 * Read a URL parameter.
 *
 * @param {string} key - The parameter key.
 * @param fallback string - (optional) value to return if the key is not found
 * @returns {string|null} The parameter value or null if not found.
 */
export function readUrlVar(key, fallback = null) {
  if ('URLSearchParams' in window) {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(key) || fallback;
  } else {
    hnlLogger.warn(NAME, 'Window has no search param support.');
    return fallback;
  }
}

/**
 * Initialize elements by adding URL tools functions.
 *
 * @param {Array} elements - The elements to initialize.
 */
export function init(elements) {
  elements.forEach((element) => {
    // Assign functions.
    element.changeUrlVar = changeUrlVar;
    element.readUrlVar = readUrlVar;
  });
}