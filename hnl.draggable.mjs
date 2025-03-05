import eventHandler from "./hnl.eventhandler.mjs";

export const NAME = 'draggable';

function RAFThrottle(callback) {
  let ticking = false;
  return function (...args) {
    if (!ticking) {
      requestAnimationFrame(() => {
        callback(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

function setupFakeScrollbar(scrollElement) {
  const scrollbarThumb = scrollElement.parentElement.querySelector('.fake-scrollbar-thumb');
  if (!scrollbarThumb) return null; // Return null instead of false for consistency

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
      //newStyles.transform = style.transform = `translateX(${thumbPosition}px)`;
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

  scrollbarThumb.updateScrollbar = updateScrollbar;
  scrollbarThumb.getStyleProperties = () => style;
  eventHandler.addListener('docShift', updateScrollbar);
  scrollElement.addEventListener('scroll', updateScrollbar);
  updateScrollbar(); // Initial update

  return scrollbarThumb;
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

  function restoreSnappingInstantly(scrollElement) {
    scrollElement.dataset.scrollSnapping = 'true';
    scrollElement.__busy = false;
  }
  function restoreSnappingGracefully(scrollElement) {
    const snapItem = document.querySelector(`.${scrollElement.dataset.snapItems}`);
    const gap = parseInt(window.getComputedStyle(snapItem.parentElement).columnGap, 10) || 0;
    const scrollPosition = scrollElement.scrollLeft;
    const scrollSize = scrollElement.scrollWidth;
    const scrollerSize = scrollElement.offsetWidth;
    const slideItemSize = snapItem.offsetWidth + gap;
    const closestSnap = Math.round(scrollPosition / slideItemSize);
    const tolerance = 2;
    let timeout = null;

    function waitToRestoreSnapping() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        scrollElement.removeEventListener('scroll', waitToRestoreSnapping);
        restoreSnappingInstantly(scrollElement);
      }, scrollPosition % slideItemSize ? 150 : 0);
    }

    if (Math.abs(scrollPosition) < tolerance || Math.abs(scrollPosition + scrollerSize - scrollSize) < tolerance) {
      scrollElement.dataset.scrollSnapping = 'true';
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

  const unbindAll = (e) => {
    console.log('unbindAll', e);
    if (dragState.isDragging) {
      restoreSnappingGracefully(container);
    } else {
      restoreSnappingInstantly(container);
    }
    document.removeEventListener('pointermove', dragMove);
    document.removeEventListener('mousemove', dragMove);
    dragState.isDragging = false;
  }

  const dragMove = (e) => {
    e.preventDefault();
    const { pageX, pageY } = e;
    const { startX, startScroll } = dragState;
    const containerBottom = container.offsetTop + container.offsetHeight;
    const outside = Math.max(pageY - containerBottom, container.offsetTop - pageY, 0);

    dragState.isDragging = Math.abs((pageX - startX) * (dragState.isDragMove ? 1 : dragState.scrollbarRatio)) > tolerance;

    if (dragState.isDragging && outside < leaveTolerance) {
      container.dataset.scrollSnapping = "false";
      container.scrollLeft = startScroll - ((pageX - startX) * (dragState.isDragMove ? 1 : -dragState.scrollbarRatio));
    } else if (outside >= leaveTolerance) {
      unbindAll();
    }
  }

  if (!isTouchDevice()) {
    container.addEventListener('mousedown', (e) => {

      dragState.startScroll = container.scrollLeft;
      dragState.startScrollY = window.scrollY;
      dragState.startX = e.pageX;
      dragState.startY = e.pageY;
      dragState.isDragMove = true;

      //start listening for movement
      document.addEventListener('mousemove', dragMove);

      //set unbind handlers
      document.addEventListener('pointerup', unbindAll, { once: true});
    });
  }

  //if we have a fake scrollbar, handle dragging on that as well. Use pointerdown to support all devices
  if (!scrollbar) return;

  scrollbar.parentElement.addEventListener('pointerdown', (e) => {

    const trackClick = scrollbar.parentElement === e.target;

    //if track is clicked, immediately scroll to that position and continue dragging
    if (trackClick) {
      container.dataset.scrollSnapping = "false";
      const multiplier = (((e.pageX - container.offsetLeft)) / container.offsetWidth);
      container.scrollLeft = scrollbar.getStyleProperties().maxScroll * multiplier;
      dragState.isDragging = true; //set true so click without drag will still recover gracefully
    }

    dragState.scrollbarRatio = container.clientWidth / (scrollbar ? scrollbar.offsetWidth : container.clientWidth);
    dragState.startScroll = container.scrollLeft;
    dragState.startScrollY = window.scrollY;
    dragState.startX = e.pageX;
    dragState.startY = e.pageY;
    dragState.isDragMove = false;

    //start listening for movement
    document.addEventListener('pointermove', dragMove, { passive: false });

    //set unbind handlers
    document.addEventListener('pointerup', unbindAll, { once: true});

  })
}


export function init(elements){
  elements.forEach(makeDraggable);
}