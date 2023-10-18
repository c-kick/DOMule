/**
 * Simple Fetch-based WP Ajax search
 * (c) 2023 HN Leussink / hnldesign
 */

import {hnlLogger} from "./hnl.logger.min.mjs";

const NAME = 'wpXMLSearch';

let controller, signal;
/**
 * Handles search when typing in the input field
 * @param {Event} e - The event object
 */
function searchWhenTyping(e) {
  const input = e.target;
  const search = input.value.trim();
  const form = input.form;

  if (!search || search.length < 2) {
    form.xmlProps.DropdownHasData = false;
    form.xmlProps.Dropdown.classList.remove('show');
  } else if (!input.searched || input.searched !== search) {
    hnlLogger.log(NAME, 'Searching for: ' + search);
    clearDropdownButKeepLoader(form.xmlProps.Dropdown);
    form.xmlProps.Dropdown.classList.add('show');
    input.searched = form.xmlProps.Params.s = search;

    // Cancel the previous request
    if (controller !== undefined) {
      controller.abort();
    }

    // Feature detect
    if ("AbortController" in window) {
      controller = new AbortController();
      signal = controller.signal;
    }

    fetch(`${form.xmlProps.Uri}?${new URLSearchParams(form.xmlProps.Params)}`, { method: 'GET', signal })
    .then(response => response.json())
    .then((jsonData) => {
      clearDropdownButKeepLoader(form.xmlProps.Dropdown);
      form.xmlProps.Loader.classList.add('d-none');
      if (jsonData.length) {
        form.xmlProps.DropdownHasData = true;
        for (const result of jsonData) {
          const { post_title, post_excerpt, guid, post_type } = result;
          form.xmlProps.Dropdown.appendChild(addListItem(post_title, post_excerpt, guid, post_type));
        }
      } else {
        const message = `Geen resultaten ${form.xmlProps.CatType}. Probeer een andere zoekterm.`;
        form.xmlProps.Dropdown.appendChild(addListItem(message));
        form.xmlProps.DropdownHasData = false;
      }
    })
    .catch(error => {
      hnlLogger.warn(NAME, error);
      clearDropdownButKeepLoader(form.xmlProps.Dropdown);
      const message = `Geen resultaten ${form.xmlProps.CatType}. Probeer een andere zoekterm.`;
      form.xmlProps.Dropdown.appendChild(addListItem(message));
      form.xmlProps.DropdownHasData = false;
    });
  }
}

/**
 * Removes all children from a dropdown except for the loader,
 * and shows the loader.
 * @param {HTMLElement} dropdownToClear - The dropdown to clear.
 */
function clearDropdownButKeepLoader(dropdownToClear) {
  // Get all children of dropdownToClear and filter out the loader.
  [...dropdownToClear.children]
  .filter(child => !child.classList.contains('loader'))
  // Remove each child.
  .forEach(child => child.remove());

  // Show the loader.
  dropdownToClear.querySelector('.loader').classList.remove('d-none');
}

/**
 * Creates a new list item element with title, description, link and category badge
 * @param {string} title - The title of the list item
 * @param {string} description - The description of the list item
 * @param {string} link - The link of the list item
 * @param {string} category - The category of the list item
 * @returns {HTMLElement} - The created list item element
 */
function addListItem(title, description, link, category) {
  const listItem = document.createElement('li');
  const linkItem = link ? document.createElement('a') : document.createElement('span');
  const titleElement = description ? document.createElement('h6') : document.createElement('span');
  const descElement = document.createElement('small');
  let catBadge = '';

  if (category === 'faq_items') {
    catBadge = '<span class="badge badge-outlined badge-primary fw-normal me-2">FAQ</span>';
  }

  titleElement.classList.add('mb-0');
  titleElement.textContent = title;
  descElement.classList.add('text-muted');
  linkItem.appendChild(titleElement);
  linkItem.appendChild(descElement);

  if (description) {
    descElement.innerHTML = catBadge + description;
  }

  if (link) {
    linkItem.href = link.replace("&#038;", "&");
    linkItem.setAttribute('title', `${title} - Klik om verder te lezen`);
  }

  linkItem.classList.add('dropdown-item','overflow-hidden', 'text-truncate');
  listItem.appendChild(linkItem);

  return listItem;
}

/**
 * Initializes the XML search input functionality for each element.
 *
 * @param {Array} elements - An array of DOM elements to initialize the search input for.
 */
export function init(elements){

  elements.forEach(function(element){

    const input = element.querySelector('.xml-search-input');

    if (!input) {
      hnlLogger.error(NAME, 'Form has no search input');
      return;
    }

    //enable search input
    input.disabled = false;

    // Set initial properties for element
    element.xmlProps = {
      Dropdown : element.querySelector('.xml-search-autocomplete'),
      Loader : element.querySelector('.loader'),
      DropdownHasData : false,
      Params : {},
      Uri : element.dataset.xmlUri,
      CatType : (typeof element.dataset.xmlType !== 'undefined') ? (element.dataset.xmlType === 'faq_items' ? ' gevonden in veelgestelde vragen' : '' ) : '',
    }

    // Extract additional XML parameters from data attributes of element
    for (const attr in element.dataset) {
      if (attr.includes('xml') && !attr.includes('xmlUri')) {
        element.xmlProps.Params[attr.replace('xml' , '').toLowerCase()] = element.dataset[attr];
      }
    }

    // Check if all required properties are set for element
    if (Object.values(element.xmlProps).some(v => v === undefined)) {
      hnlLogger.error(NAME, 'Not all required settings set');
      return;
    }

    /**
     * Hides the dropdown when input loses focus.
     *
     * @param {Event} e - The event object.
     */
    function hideOnBlur(e){
      //workaround for onfocusout having no relatedTarget (due to tabindex/focussable issues)
      if(!element.contains(e.target)) {
        input.removeEventListener('keyup', searchWhenTyping);
        document.body.removeEventListener('click', hideOnBlur);
        element.xmlProps.Dropdown.classList.remove('show');
      }
    }

    /**
     * Triggers a search when the user types in the input field.
     */
    input.addEventListener('search', function(e){
      const search = input.value.trim();
      if (!search) {
        //user clears searchbox
        element.xmlProps.DropdownHasData = false;
        element.xmlProps.Dropdown.classList.remove('show');
        clearDropdownButKeepLoader(element.xmlProps.Dropdown);
      }
    });

    input.addEventListener('focusin', function(e){
      input.addEventListener('keyup', searchWhenTyping);
      document.body.addEventListener('click', hideOnBlur);
      element.xmlProps.Dropdown.classList.toggle('show', element.xmlProps.DropdownHasData);
    });
  })
}