/**
 * Custom simple scrollspy by hnldesign (c) 2022-2023
 *
 * Usage: <div data-requires="./modules/hnl.scrollspy" data-scroll-offset="--navbar-height" data-link-class="jumplink" data-menu-target="#menuList">
 *   data-link-class is used to specify which link class to watch out for in page content, NOT the links that are assigned the 'active' class; those are taken
 *   from the data-menu-target: all its <a>-children are processed.
 *   An offset can be specified as css variable or px value (with/without 'px')
 *   The data-menu-target is the element that contains the jump links that need to have the 'active' class (or have it removed)
 *   if your anchor does not contain a hash, but you want it to respond to an id anyway, add 'data-scroll-trigger' to it, and set it to the corresponding id
 */

import eventHandler from "./hnl.eventhandler.mjs";

export const NAME = 'scrollSpy';

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-reqruires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */

export function init(elements){
  elements.forEach(function(element){
    let offset = 0;

    if (!element.dataset.menuTarget || !element.dataset.linkClass) {
      throw new TypeError('No menu target (data-menu-target) and/or link class (data-link-class) specified!');
    }
    element._menuTgt = document.getElementById(element.dataset.menuTarget.trim().slice(1));
    element._offset = element.dataset.scrollOffset || 0;
    element._jumpLinks = document.querySelectorAll(`.${element.dataset.linkClass.trim()}`);

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
      element._menuTgt.querySelectorAll('a').forEach(function(link){
        if (link.href.trim().split('#')[1] === activeJumplink || link.dataset.scrollTrigger === activeJumplink) {
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