import eventHandler from "./hnl.eventhandler.mjs";

export const NAME = 'draggable';

function RAFThrottle(callback) {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
      requestAnimationFrame(() => {
        callback(...args);
        ticking = false;
      });
  };
}

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints;

function setupFakeScrollbar(scrollElement) {
  const scrollbarThumb = scrollElement.parentElement.querySelector('.fake-scrollbar-thumb');
  if (!scrollbarThumb) return null; // Return null instead of false for consistency
  const scrollbarTrack = scrollbarThumb.parentElement;

  // Object to store styles and dimensions
  const style = { width: null, transform: null, clientWidth: null, scrollWidth: null, scrollLeft: null };

  function updateSelf() {
    const { scrollWidth, clientWidth, scrollLeft } = scrollElement;

    // Avoid unnecessary updates if dimensions haven't changed
    if (style.clientWidth === clientWidth && style.scrollWidth === scrollWidth && style.scrollLeft === scrollLeft) {
      return;
    }

    style.clientWidth = clientWidth;
    style.scrollWidth = scrollWidth;

    style.maxScroll = scrollWidth - clientWidth;
    if (style.maxScroll <= 0) {
      if (style.width !== "0px") {
        scrollbarThumb.style.width = "0px"; // Hide if no overflow
        style.width = "0px";
      }
      return;
    }

    const thumbWidth = Math.round((clientWidth / scrollWidth) * clientWidth);
    const thumbPosition = Math.round(((scrollLeft / style.maxScroll) * (clientWidth - thumbWidth)) * 10) / 10;
    const newStyles = {};

    // Only update transform if scrollLeft changed
    if (style.scrollLeft !== scrollLeft) {
      style.scrollLeft = scrollLeft;
      newStyles.transform = style.transform = `translate3d(${thumbPosition}px, 0, 0)`; // Use translate3d for better performance
    }

    // Only update width if necessary
    if (style.width !== `${thumbWidth}px`) {
      newStyles.width = style.width = `${thumbWidth}px`;
    }

    if (Object.keys(newStyles).length > 0) {
      Object.assign(scrollbarThumb.style, newStyles);
    }

    // Update own extended dimensions
    style.dimensions = scrollbarThumb.getBoundingClientRect();
  }

  // Throttle the update function
  const updateScrollbar = RAFThrottle(updateSelf);

  scrollbarTrack.getThumb = () => scrollbarThumb;
  scrollbarTrack.getStyleProperties = () => style;
  eventHandler.addListener('docShift', updateScrollbar);
  scrollElement.addEventListener('scroll', updateScrollbar, { passive: true });
  updateScrollbar(); // Initial update

  return scrollbarTrack;
}

function makeDraggable(container) {
  const dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollbarRatio: 1,
    startScroll: 0,
    startScrollY: window.scrollY
  }
  const leaveTolerance = 100; //pixels moved outside the container to stop responding to drag events
  const tolerance = 2; //pixels dragged (mousedown + move) before we actually consider a drag event
  const scrollbar = setupFakeScrollbar(container);

  function restoreSnapping(scrollElement) {
    scrollElement.dataset.scrollSnapping = 'true';
    scrollElement.__busy = false;
  }

  function restoreSnappingGracefully(scrollElement) {
    const { scrollWidth : scrollSize, scrollLeft : scrollPosition, offsetWidth : scrollerSize } = scrollElement;
    const snapItem = document.querySelector(`.${scrollElement.dataset.snapItems}`);
    const gap = parseInt(window.getComputedStyle(snapItem.parentElement).columnGap, 10) || 0;
    const slideItemSize = snapItem.offsetWidth + gap;
    const closestSnap = Math.round(scrollPosition / slideItemSize);
    const tolerance = 2;
    let timeout = null;

    function waitToRestoreSnapping() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        restoreSnapping(scrollElement);
        scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
      }, scrollPosition % slideItemSize ? 150 : 0);
    }

    if (Math.abs(scrollPosition) < tolerance || Math.abs(scrollPosition + scrollerSize - scrollSize) < tolerance) {
      //restoreSnapping(scrollElement);
      scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
    } else {
      scrollElement.scrollTo({
        left: closestSnap * slideItemSize,
        behavior: 'smooth'
      });
      scrollElement.__busy = true;
      scrollElement.addEventListener('scroll', waitToRestoreSnapping);
    }
  }

  const dragListeners = {
    move: (e) => dragMove(e),
    end: () => unbindAll()
  };

  const unbindAll = (e) => {
    if (dragState.isDragging) {
      restoreSnappingGracefully(container);
    } else {
      restoreSnapping(container);
    }
    document.removeEventListener('pointermove', dragListeners.move);
    document.removeEventListener('mousemove', dragListeners.move);
    dragState.isDragging = false;
    container.classList.remove('grabbed-direct', 'grabbed-scrollbar');
  }

  const dragMove = (e) => {
    e.preventDefault();
    const { pageX, pageY } = e;
    const { startX, startScroll } = dragState;
    const containerBottom = container.offsetTop + container.offsetHeight;
    const outside = Math.max(pageY - containerBottom, container.offsetTop - pageY, 0);

    dragState.isDragging = Math.abs((pageX - startX) * (dragState.directDrag ? 1 : dragState.scrollbarRatio)) > tolerance;

    if (dragState.isDragging && outside < leaveTolerance) {
      container.dataset.scrollSnapping = "false";
      container.scrollLeft = startScroll - ((pageX - startX) * (dragState.directDrag ? 1 : -dragState.scrollbarRatio));
    } else if (outside >= leaveTolerance) {
      unbindAll();
    }
  }

  const setStateProps = (e, directDrag) => {
    Object.assign(dragState, {
      startScroll: container.scrollLeft,
      startScrollY: window.scrollY,
      startX: e.pageX,
      startY: e.pageY,
      directDrag
    });

    //start listening for movement
    if (dragState.directDrag) {
      //directDrag means dragging the scroll container itself, not the (optional) scrollbar
      document.addEventListener('mousemove', dragListeners.move);
      //set grab class
      container.classList.add('grabbed-direct');
    } else if (scrollbar) {
      document.addEventListener('pointermove', dragListeners.move, { passive: false });
      //set grab class
      container.classList.add('grabbed-scrollbar');
    }
    //set unbind handlers
    document.addEventListener('pointerup', dragListeners.end, { once: true });
  }

  if (!isTouchDevice()) {
    container.addEventListener('mousedown', (e) => {
      setStateProps(e, true);
    });
  }

  //if we have a fake scrollbar, handle dragging on that as well. Use pointerdown to support all devices
  if (!scrollbar) return;
  scrollbar.addEventListener('pointerdown', (e) => {

    if (scrollbar === e.target) {
      //if track is clicked, immediately scroll to that position and continue dragging
      container.dataset.scrollSnapping = "false";
      const multiplier = (((e.pageX - container.offsetLeft)) / container.offsetWidth);
      container.scrollLeft = scrollbar.getStyleProperties().maxScroll * multiplier;
      dragState.isDragging = true; //set true so a click on the track not followed by a drag will still recover gracefully
    }

    dragState.scrollbarRatio = container.clientWidth / (scrollbar ? scrollbar.getThumb().offsetWidth : container.clientWidth);

    setStateProps(e, false);
  })
}


export function init(elements){
  elements.forEach(makeDraggable);
}