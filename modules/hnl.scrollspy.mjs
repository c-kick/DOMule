/**
 * Custom simple scrollspy by hnldesign (c) 2022
 * Usage: <div data-requires="./modules/hnl.scrollspy" data-scroll-offset="--navbar-height" data-menu-target="#menuList">
 *   offset can be specified as css variable or px value (with/without 'px')
 *   menu-target is the element that contains the jump links that need to have the 'active' class (or have it removed)
 */

import eventHandler from "./hnl.eventhandler.mjs";

const NAME = 'scrollSpy';

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-reqruires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */

export function init(elements){
  elements.forEach(function(element){
    let offset = 0;

    if (!element.dataset.menuTarget) {
      throw new TypeError('No menu target (data-menu-target) specified!');
    }
    element._menuTgt = document.getElementById(element.dataset.menuTarget.trim().slice(1));
    element._offset = element.dataset.scrollOffset || 0;
    element._jumpLinks = element.querySelectorAll('.jumplink');

    eventHandler.addListener('docShift', function(){
      offset = parseInt(((element._offset.toString().trim().slice(0, 2) === '--') ? document.documentElement.style.getPropertyValue(element._offset) : element._offset), 10);
      let activeJumplink = '';
      // The empty value makes an empty hash link (href="#") active when no target can be found that has
      // been scrolled past. Useful for 'home' links. Don't want this? change '' to null.
      Object.values(element._jumpLinks).reverse().forEach(function(jumpLink){
        if (((jumpLink.getBoundingClientRect().y - offset) <= 0) && !activeJumplink) {
          activeJumplink = jumpLink.id;
        }
      });
      element._menuTgt.querySelectorAll('[href^="#"]').forEach(function(link){
        if (link.href.trim().split('#')[1] === activeJumplink) {
          link.classList.add('active');
          link.ariaCurrent = "page";
        } else {
          link.classList.remove('active');
          link.removeAttribute('aria-current');
        }
      });
    })();
  })
}