export const NAME = 'dom';

/** waitForComplexNode - 2024
 *
 * Waits for a complex node to appear in the DOM, supporting shadow DOM querying, and runs a callback on it.
 * Continues checking until the node is found or the specified timeout is reached.
 *
 * @param {Function} getNode - A function that returns the target node or null if not found.
 *                             Example: () => document.querySelector('selector')?.shadowRoot.querySelector('child-selector')
 * @param {Function} callback - A function to execute when the target node is found.
 *                              Receives the found node as its argument.
 * @param {number} [timeout=30000] - Maximum waiting time in milliseconds (default is 30 seconds).
 * @param {number} [interval=100] - Time interval between each check in milliseconds (default is 100ms).
 *
 * @returns {void}
 *
 * @example
 * // Usage example for a simple element:
 * waitForComplexNode(
 *   () => document.querySelector(".my-simple-element"),
 *   node => {
 *     console.log("Simple node found:", node);
 *   }
 * );
 *
 * @example
 * // Usage example for a complex shadow DOM element:
 * waitForComplexNode(
 *   () => document.querySelector("body > top-level-element")?.shadowRoot.querySelector("element-inside-shadow-root"),
 *   node => {
 *     console.log('Complex node found:', node);
 *   }
 * );
 */
export function waitForComplexNode(getNode, callback, timeout = 30000, interval = 100) {
    const startTime = Date.now();

    (function checkNode() {
        let node;
        try {
            node = getNode(); // Try executing the function to get the node
        } catch (e) {
            node = null; // If it fails due to shadow DOM not being ready, treat it as not found
        }
        if (node) return callback(node);
        if (Date.now() - startTime < timeout) return setTimeout(checkNode, interval);
        console.warn(`Node not found within ${timeout / 1000} seconds.`);
    })();
}

/**
 * Converts an HTML string into a DOM Node or NodeList.
 *
 * If the input string represents a single HTML element, the function returns that element.
 * If the string contains multiple sibling elements, it returns a NodeList of those elements.
 * This function is useful for dynamically generating DOM elements from string templates.
 *
 * @param {string} string - The HTML string to be converted into DOM elements.
 * @returns {ChildNode | NodeList} A DOM Node if the string represents a single element, or a NodeList of nodes if the string contains multiple top-level elements.
 * @example
 * // For a single element string
 * const element = stringToObj('<div>Hello World</div>');
 * console.log(element); // Logs the div element
 *
 * // For a multi-element string
 * const nodeList = stringToObj('<div>Hello</div><span>World</span>');
 * console.log(nodeList); // Logs a NodeList containing the div and span
 */
export function stringToObj(string) {
    //A <template> internally uses a documentFragment. After the function terminates, this is eligible for garbage collection, so this is more memory efficient than using an actual DOM node
    const template = document.createElement('template');
    template.innerHTML = string.trim();
    const content = template.content;
    return content.childElementCount === 1 ? content.firstElementChild : content.children;
}

/**
 * Get the path of the current script file.
 *
 * @returns {string} The path of the current script file.
 */
export function getScriptPath() {
    if ('noModule' in HTMLScriptElement.prototype && typeof import.meta !== 'undefined' && typeof import.meta.url === 'string') {
        // ES module support
        return new URL(import.meta.url).pathname;
    } else {
        // Legacy support
        let uriRegex  = new RegExp(/\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?Â«Â»â€œâ€â€˜â€™]))/ig);
        let traceUrls = new Error().stack.match(uriRegex);
        return traceUrls[traceUrls.length - 1].substring(0, traceUrls[traceUrls.length - 1].lastIndexOf('/'));
    }
}

/**
 * Writes a CSS file to the page
 *
 * @param {string} src - The URL of the CSS file to load
 * @returns {boolean} - Returns true if the CSS file was successfully loaded
 * @throws {Error} - Throws an error if the src parameter is not provided
 */
export function writeCSS(src) {
    if (!src) {
        throw new Error(`No CSS file path provided`);
    }
    const link = document.createElement('link');
    link.setAttribute('type', 'text/css');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', src);
    document.head.appendChild(link);
    return true;
}