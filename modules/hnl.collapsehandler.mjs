/**
 * Adds functionality to Bootstrap's native 'collapse'
 */
import Collapse from "../libs/bs-5.2.0/src/collapse.js";
import {isVisible} from "./hnl.helpers.mjs";
/**
 * init
 */
export function init(elements){
  elements.forEach((element) => {

    if (element.classList.contains('accordion')) {

      /* Open an accordion item if a hash corresponding to its ID was used when opening the page */
      element.querySelectorAll('.accordion-item').forEach((accordionItem) => {
        if (`#${accordionItem.querySelector('.jumplink').getAttribute('id')}` === window.location.hash) {
          Collapse.getOrCreateInstance(accordionItem.querySelector('.collapse'), {  }).show();
        }
      })

      /* Makes sure an accordion item is scrolled into view when it's opened and going out of view at either the top or bottom of the viewport.*/
      element.addEventListener('shown.bs.collapse', event => {
        const measure = event.target.closest('.accordion-item') ? event.target.closest('.accordion-item') : event.target;

        if (!element.classList.contains('accordion-no-hash')) {
          const id = (measure.closest('.jumplink') || measure.querySelector('.jumplink')).getAttribute('id');
          history.replaceState(null, null, `#${id}`);
        }

        let deductHeight = parseFloat(document.documentElement.style.getPropertyValue('--site-header-height'));
        if (document.querySelector('.accordion .position-sticky.stuck')) {
          deductHeight += document.querySelector('.accordion .position-sticky.stuck').offsetHeight;
        }

        isVisible(measure, (visible, rect, vp)=> {
          if (!visible) {
            //is not visible
            if (rect.bottom > vp.bottom && rect.height < (vp.bottom - vp.top)) {
              //element is out of at the bottom, but not larger than the viewport, scroll so the bottom touches the bottom of the viewport
              window.scrollTo({
                top: (rect.bottom - vp.bottom) + (window.pageYOffset || document.documentElement.scrollTop),
                left: 0,
                behavior: "auto",
              });
            } else if (rect.top < vp.top) {
              //element is out of view at the top, scroll so the top touches the top of the viewport
              window.scrollTo({
                top: rect.pageY - deductHeight,
                left: 0,
                behavior: "auto",
              });
            }
          }
        }, {
          top: deductHeight,
        })
      })
    }

  })
}