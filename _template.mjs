/**
 * Module template example
 */

import {isVisible} from "./hnl.helpers.mjs";
import eventHandler from "./hnl.eventhandler.mjs";

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-reqruires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export const NAME = 'exampleModule';
export function init(elements){

  /**
   example function that takes all the elements (those with 'data-requires' set for this module) and checks if they
   visible on each scroll/resize. This one is useful for doing fancy things like fading-in/-up elements as soon as
   they enter the user's view
   @uses docShift
   @uses isVisible
   */
  eventHandler.addListener('docShift', () => {
    elements.forEach(function(element){
      isVisible(element, function(visible) {
        if (visible) {
          console.log(element, visible);
        }
      })
    })
  });

}