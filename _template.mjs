/**
 * Module template - use this as a boilerplate for writing your own modules. Then import them into your frontend by
 * assigning them to a node using the data-requires attribute.
 *
 * E.g. save it as myfirstmodule.mjs, and then add it with <div data-requires="myfirstmodule.mjs">
 * (after following the basic usage instructions @ https://github.com/c-kick/js-modules?tab=readme-ov-file#basic-usage)
 */

/**
 * Imports, for example purposes
 */
import {isVisible} from "./util.observe.mjs"; //a function
import events from "./core.events.mjs"; //a class
import {logger} from "./core.log.mjs"; //an object
import {ModuleRegistry} from "./core.registry.mjs"; //inter-module coordination

/**
 * The name for this module, used in logging and identifying dynamically loaded modules
 * @type {string}
 */
export const NAME = 'exampleModule';

/**
 * Optional: API for inter-module coordination.
 * Export this function to allow other modules to interact with yours.
 * Use a switch statement to handle different actions.
 *
 * Recommended action naming:
 * - get* for queries (getState, getCount)
 * - on* for callbacks (onChange, onComplete)
 * - set* for mutations (setState, setData)
 * - verbs for commands (play, pause, reset)
 *
 * @param {string} action - The action to perform
 * @param {...*} args - Action-specific arguments
 * @returns {*} Action-specific return value
 *
 * @example
 * // In another module:
 * ModuleRegistry.waitFor('exampleModule')
 *   .then(module => {
 *     const state = module.api('getState');
 *     module.api('onChange', callback);
 *   });
 */
export function api(action, ...args) {
    switch(action) {
        case 'getState':
            // Return current state
            return {
                initialized: true,
                elementCount: elements.length
            };

        case 'onChange':
            // Register callback for changes
            const callback = args[0];
            if (typeof callback === 'function') {
                changeListeners.push(callback);
            }
            break;

        case 'reset':
            // Perform some action
            resetModule();
            break;

        default:
            logger.warn(NAME, `Unknown action: ${action}`);
            return null;
    }
}

// Example internal state (if using api())
let elements = [];
let changeListeners = [];

/**
 * init
 * Exported function that is called (if present) when the module has been imported via the data-requires method,
 * as described in, and handled by, the core.loader module.
 * @param {HTMLElement[]} els - Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(els) {
    elements = els;

    /**
     * Do stuff here. You can safely assume the page is ready now, as the importing of dynamically loaded modules depends
     * on reading data-attributes, which can only be safely traversed and read when the page is ready,
     * as handled in the 'docReady' handler of the eventHandler module.
     * If you want to say something to the console logger, make sure the init returns a string with the message.
     * If you want to explicitly fail, return false.
     */

    /**
     * Example: Check if another module is available (optional dependency)
     */
    if (ModuleRegistry.isLoaded('gallery')) {
        const gallery = ModuleRegistry.get('gallery');
        if (typeof gallery.api === 'function') {
            const images = gallery.api('getImages');
            logger.info(NAME, `Found ${images.length} gallery images`);
        }
    }

    /**
     * Example: Wait for another module (async coordination)
     */
    ModuleRegistry.waitFor('analytics', 2000)
        .then(analytics => {
            // Analytics available, use it
            logger.info(NAME, 'Connected to analytics');
            analytics.api('track', 'module_initialized', {name: NAME});
        })
        .catch(error => {
            // Analytics not available or doesn't have api()
            logger.info(NAME, 'Running without analytics');
        });

    /**
     * Example function that checks element visibility on scroll/resize.
     * This is useful for doing fancy things like fading-in/-up elements as soon as
     * they enter the user's view.
     * @uses docShift
     * @uses isVisible
     */
    events.addListener('docShift', () => {
        elements.forEach(function (element) {
            isVisible(element, function (visible) {
                if (visible) {
                    logger.log(NAME, `${element} visible? ${(visible ? 'Yes' : 'No')}`);

                    // Notify listeners if using api()
                    changeListeners.forEach(cb => cb({element, visible}));
                }
            })
        })
    });

    return `Initialized with ${elements.length} element(s)`;
}

/**
 * Example internal function (if using api())
 */
function resetModule() {
    logger.info(NAME, 'Reset called');
    changeListeners.forEach(cb => cb({reset: true}));
}