import eventHandler from "./hnl.eventhandler.mjs"; //a class

export const NAME = 'draggable';

function restoreSnappingGracefully(scrollElement) {
  const scrollingXAxis = true;
  const snapItem = document.querySelectorAll(`.${scrollElement.dataset.snapItems}`)[0];
  const gap = parseInt(window.getComputedStyle(snapItem.parentElement).getPropertyValue(scrollingXAxis ? 'column-gap' : 'row-gap'), 10);
  const additionalGap = isNaN(gap) ? 0 : gap;
  const scrollPosition = scrollingXAxis ? scrollElement.scrollLeft : scrollElement.scrollTop;
  const scrollSize = scrollingXAxis ? scrollElement.scrollWidth : scrollElement.scrollHeight;
  const scrollerSize = scrollingXAxis ? scrollElement.offsetWidth : scrollElement.offsetWidth;

  const slideItemSize = (scrollingXAxis ? snapItem.offsetWidth : snapItem.offsetHeight) + additionalGap;
  const closestSnap = Math.round(scrollPosition / slideItemSize);
  const tolerance = 2; //pixels
  let timeout = null;

  function waitToRestoreSnapping() {
    clearTimeout(timeout);
    let wait = (scrollPosition % slideItemSize) ? 150 : 0;
    timeout = setTimeout(()=>{
      //snapped gracefully, restore snapping
      scrollElement.dataset.scrollSnapping = 'true';
      scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
      scrollElement.__busy = false;
    }, wait);
  }

  if (
    Math.abs(scrollPosition) < tolerance ||
    Math.abs((scrollPosition + scrollerSize) - scrollSize) < tolerance
  ) {
    //Already at snapping point, no need to restore snapping gracefully
    console.log('Already at snapping point, no need to restore snapping gracefully')
    scrollElement.dataset.scrollSnapping = 'true';
    scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
  } else {
    //snap gracefully
    scrollElement.scrollTo({
      top: scrollingXAxis ? 0 : (closestSnap * slideItemSize),
      left: scrollingXAxis ? (closestSnap * slideItemSize) : 0,
      behavior: 'smooth'
    });
    scrollElement.__busy = true;
    scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
    scrollElement.addEventListener('scroll', waitToRestoreSnapping);
  }
}

const makeDraggable = (container, changeCursor = false) => {
  let isDragging = false, startX = 0, scrollLeft = 0;
  const tolerance = 2; //pixels dragged (mousedown + move) before we actually consider a drag event
  container.dataset.scrollSnapping = "true";

  const setCursor = (cursor) => container.style.cursor = cursor;

  const mouseMove = (e) => {
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    isDragging = (Math.abs(x - startX) > tolerance);
    if (isDragging) {
      container.dataset.scrollSnapping = "false";
      container.scrollLeft = scrollLeft - (x - startX);
    }
  }

  const stopEverything = () => {
    if (isDragging) {
      restoreSnappingGracefully(container);
    }
    if (changeCursor) setCursor('grab');
    container.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup', stopEverything);
    isDragging = false;
  }

  container.addEventListener('mousedown', (e) => {
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    if (changeCursor) setCursor('grabbing');
    container.addEventListener('mousemove', mouseMove);
    document.addEventListener('mouseup', stopEverything);
  });

}

export function init(elements){
  eventHandler.addListener('docShift', () => {
    elements.forEach(function(element){
      makeDraggable(element);
    })
  });

}