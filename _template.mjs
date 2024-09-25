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
import {isVisible} from "./hnl.helpers.mjs"; //a function
import eventHandler from "./hnl.eventhandler.mjs"; //a class
import {hnlLogger} from "./hnl.logger.mjs"; //an object

/**
 * The name for this module, used in logging and identifying dynamically loaded modules
 * @type {string}
 */
export const NAME = 'exampleModule';

/**
 * init
 * Exported function that is called (if present) when the module has been imported via the data-requires method,
 * as described in, and handled by, the hnl.dynamicimports module.
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(elements){
  /**
   * Do stuff here. You can safely assume the page is ready now, as the importing of dynamically loaded modules depends
   * on reading data-attributes, which can only be safely traversed and read then the page is ready,
   * as handled in the 'docReady' handler of the eventHandler module.
   */

  /**
   example function that takes all the elements (those with 'data-requires' set for this module) and checks if they
   are visible on each scroll/resize. This is useful for doing fancy things like fading-in/-up elements as soon as
   they enter the user's view.
   @uses docShift
   @uses isVisible
   */
  eventHandler.addListener('docShift', () => {
    elements.forEach(function(element){
      isVisible(element, function(visible) {
        if (visible) {
          hnlLogger.log(NAME, `${element} visible? ${(visible ? 'Yes' : 'No')}`);
        }
      })
    })
  });

}