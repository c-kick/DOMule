/**
 * Module template
 */

const menus = [];
const cssClasses = {
  open: 'open',
  opening: 'opening',
  opened: 'opened',
  closing: 'closing',
}

const transDone = function() {
  let opening = this.classList.contains(cssClasses.opening);
  if (opening) {
    this.classList.remove(cssClasses.opening);
    this.classList.add(cssClasses.opened);
  } else {
    this.classList.remove(cssClasses.closing);
    this.classList.remove(cssClasses.open);
  }
  this.classList.toggle(cssClasses.opened, opening);

  this.removeEventListener('transitionend', transDone);
}

/**
 * init
 * Exported function that is called (if present) when the module has imported via the data-reqruires method
 * @param elements {object} Holds *all* DOM elements that had 'data-requires' specified for this module
 * 'this' will be the module object context
 */
export function init(elements){
  elements.forEach(function(element, i){

    menus.push({
      button: element,
      menuContainer: document.querySelectorAll('.nok-menu-container')[0],
      toggleMenu: function() {
        let enabled = (document.body.classList.contains('md') || document.body.classList.contains('sm') || document.body.classList.contains('xs'));
        if (enabled) {
          document.body.classList.toggle('no-scrolling-md');

          //menus[i].button.classList.toggle(cssClasses.open);

          let opening = !menus[i].menuContainer.classList.contains(cssClasses.open);
          if (opening) {
            menus[i].menuContainer.classList.add(cssClasses.open);
            menus[i].menuContainer.classList.toggle(cssClasses.opening);
          } else {
            menus[i].menuContainer.classList.remove(cssClasses.opened);
            menus[i].menuContainer.classList.remove(cssClasses.opening);
            menus[i].menuContainer.classList.toggle(cssClasses.closing);
          }
          menus[i].menuContainer.addEventListener('transitionend', transDone);
        }
      }
    });

    //toggle menu on click
    menus[i].button.addEventListener('click', menus[i].toggleMenu);

    //close menu on click on anchor inside (except for '_blank' links)
    menus[i].menuContainer.querySelectorAll('a').forEach(function(link){
      if (link.target !== '_blank') {
        link.addEventListener('click', menus[i].toggleMenu)
      }
    });

  })
}