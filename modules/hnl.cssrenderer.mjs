/**
 * Renders CSS to inline HTML style attributes
 */
import {hnlLogger} from "./hnl.logger.mjs";

export const NAME = 'cssRenderer';

/**
 Renders CSS styles inline for a given element and its children.
 @param {HTMLElement} element - The target element to render CSS styles inline.
 @param {boolean} [recursive=true] - Determines if the CSS styles should be rendered recursively for child elements.
 @param cssName {string} - Title of the CSS sheet to apply. If omitted, apply all found stylesheets on page
 */
export function renderCSS(element, recursive = true, cssName) {
  if (!element) {
    throw new Error("No element specified.");
  }
  if (element.tagName === 'TD') {
    //set height="<x>" attribute for TD. It is deprecated, but all browsers still respect this
    //element.setAttribute('height', element.offsetHeight);
  }

  //apply only rules from sheets that should be applied for this element
  let matches = [];
  for (const sheet of document.styleSheets) {
    if (cssName && sheet.title !== cssName) continue;
    const rules = sheet.rules || sheet.cssRules;
    for (const rule of rules) {
      try {
        if (element.matches(rule.selectorText)) {
          matches.push(rule);
        }
      } catch (e) {
        hnlLogger.error(NAME, e);
      }
    }
  }

  // we need to preserve any pre-existing inline styles.
  const srcRules = document.createElement(element.tagName).style;
  srcRules.cssText = element.style.cssText;
  matches.forEach(rule => {
    for (let prop of rule.style) {
      if (prop === 'pointer-events' || prop === 'cursor') continue;
      let val = srcRules.getPropertyValue(prop) || rule.style.getPropertyValue(prop);
      let priority = rule.style.getPropertyPriority(prop);
      element.style.setProperty(prop,val,priority);
    }
  });
  if (recursive) {
    let d = element.children.length;
    while (d--){
      renderCSS(element.children[d], recursive, cssName);
    }
  }
}


export function init(elements){
  hnlLogger.info(NAME, `Parsing ${elements.length} elements...`);
  elements.forEach((element) => {
    renderCSS(element, true, (element.dataset.cssName ? element.dataset.cssName : ''));
  });
  hnlLogger.info(NAME, `Done.`);
}