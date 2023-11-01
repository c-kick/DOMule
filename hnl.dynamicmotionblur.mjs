/**
 * Dynamic Motion blur handler v0.0.1 - 31-10-2023
 *
 * Adds motionblur on the fly. Further refinement of motionblur.mjs module
 */
import eventHandler from "./hnl.eventhandler.mjs";
import {hnlLogger} from "./hnl.logger.mjs";
import {hiresLoop, toMS} from "./hnl.helpers.mjs?debug=true";
import {debounceThis} from "./hnl.debounce.mjs";

export const NAME = 'dynamicMotionBlur';

const _defaults = {
  frameInterval: 60, //base interval for calculations. Recommended value is 60
  spinDownTime: 200, //time in ms to resolve an unfinished blur (abrupt stops, etc)
  blurThresh: 0.3, //deviation below this value is not considered noticeable motion blur
  hysteresis: 0.2, //hysteresis for when blur threshold has been met
  events: {
    scrollStart: new Event("scrollStart"),
    scrolling: new Event("scrolling"),
    scrollStop: new Event("scrollStop"),
    blurStart: new Event("blurStart"),
    blurring: new Event("blurring"),
    blurStop: new Event("blurStop"),
  }
}

function calcBlur(speed, shutter) {
  /* The 180-degree Shutter Rule states that whatever the framerate the shutter speed should be double. */
  let shutterSpeed = ((60 * 360) / shutter); // 60fps is screen refresh rate. Do not confuse this with requestAnimationFrame/FPS.
  let exposure = 1000 / shutterSpeed; //length of 1 frame of exposure (in ms).
  //speed is in px/ms. Length of one frame in ms is now in 'exposure', now we'll blur half that distance.
  return ((speed * exposure) / 2 || 0);
}

function createSVGFilter(element, index, options) {
  const ns = 'http://www.w3.org/2000/svg';
  const idx = `filter-${index}`;
  const filterRef = `motionblur-${idx}`;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'filters');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('id', idx);

  const def = document.createElementNS(ns, 'defs');

  const filter = document.createElementNS(ns, 'filter');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'auto');
  filter.setAttribute('id', filterRef);

  const gb = document.createElementNS(ns, 'feGaussianBlur');
  gb.setAttribute('in', 'SourceGraphic');
  gb.setAttribute('id', `motionblur-params-${idx}`);
  gb.setAttribute('stdDeviation', '0,0');
  gb.setAttribute('edgeMode', 'wrap');

  const animator = document.createElementNS(ns, 'animate');
  animator.setAttribute('attributeName', 'stdDeviation');
  animator.setAttribute('begin', 'indefinite');
  animator.setAttribute('values', '0');
  animator.setAttribute('dur', `${options.spinDownTime}ms`);
  animator.setAttribute('repeatCount', '1');
  animator.setAttribute('fill', 'freeze');
  animator.setAttribute('restart', 'always');
  animator.setAttribute('id', `motionblur-animator-${idx}`);

  gb.appendChild(animator);
  filter.appendChild(gb);
  def.appendChild(filter);
  svg.appendChild(def);
  document.body.appendChild(svg);

  //assign filter as css variable to element
  element.style.setProperty('--blur-filter', `url('#${filterRef}')`);

  return {
    spinDown: null,
    direction: 'horizontal',
    stdDeviationValue: function (val) {
      return (this.direction === 'horizontal') ? `${val},0` : `0,${val}`;
    },
    adjust: function (value, direction) {
      this.direction = direction;
      //round off to one decimal
      value = Math.round(value * 10) / 10;

      gb.setAttribute('stdDeviation', this.stdDeviationValue(value));
      animator.endElementAt(0);

      //stop any active spindown
      if (this.spinDown) {
        clearTimeout(this.spinDown);
        this.spinDown = null;
      }
      this.spinDown = setTimeout(()=>{
        animator.beginElement();
        console.log('easing');
      }, options.frameInterval);

      animator.setAttribute('values', `${this.stdDeviationValue(value)};0,0`);
    }
  }

}

export function init(elements) {
  elements.forEach((elem, index) => {
    //define options for this element
    const options = {
      shutterAngle: !isNaN(parseInt(elem.dataset.shutterAngle, 10)) ? parseInt(elem.dataset.shutterAngle, 10) : 180,
      scrollDirection: elem.dataset.scrollDirection,
      ..._defaults
    };
    //check if hysteresis is out of bounds
    options.hysteresis = (options.hysteresis >= options.blurThresh) ? Math.floor(options.blurThresh) : options.hysteresis;

    //create svg filter, maintain a reference as this returns some functionality
    options.filter = createSVGFilter(elem, index, options);

    //handle logic from main scroll event
    elem.addEventListener('scroll', (e) => {
      //dispatch start scroll or running scroll
      if (!elem.scrolling) {
        elem.dispatchEvent(options.events.scrollStart);
        elem.scrolling = true;
      } else if (elem.scrolling) {
        elem.dispatchEvent(options.events.scrolling);
      }

      //determine variables
      const horizontal = options.scrollDirection === 'horizontal';
      const now = performance.now();
      const time = now - (elem.prevTimeStamp ? elem.prevTimeStamp : 0);
      const distance = horizontal ?
        elem.scrollLeft - (elem.prevScrollLeft ? elem.prevScrollLeft : 0) :
        elem.scrollTop - (elem.prevScrollTop ? elem.prevScrollTop : 0);
      const multiplier = !isNaN(parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10)) ? parseInt(window.getComputedStyle(e.target).getPropertyValue('--scaler-perf'), 10) : 1;

      //calculate speed and resulting blur
      elem.scrollSpeed = (Math.abs(distance) / time); //px/ms
      elem.blurAmount = Math.round((calcBlur(elem.scrollSpeed, options.shutterAngle) / multiplier) * 10) / 10;

      //dispatch blur related events
      if (elem.blurAmount > options.blurThresh && !elem.blurring) {
        elem.dispatchEvent(options.events.blurStart);
        elem.blurring = true;
      } else if (elem.blurAmount <= options.blurThresh && elem.blurring) {
        //check is hysteresis met
        if ((elem.blurAmount + options.hysteresis) <= options.blurThresh) {
          elem.dispatchEvent(options.events.blurStop);
          elem.blurring = false;
        }
      } else if (elem.blurring) {
        elem.dispatchEvent(options.events.blurring);
      }

      //store values for next iteration
      elem.prevScrollTop = elem.scrollTop;
      elem.prevScrollLeft = elem.scrollLeft;
      elem.prevTimeStamp = now;

      //run the scroll/snap complete methodology
      //https://stackoverflow.com/questions/65952068/determine-if-a-snap-scroll-elements-snap-scrolling-event-is-complete/66029649#66029649
      clearTimeout(elem.scrollTimeout);
      elem.scrollTimeout = setTimeout(() => {
        if (elem.scrolling) {
          elem.dispatchEvent(options.events.scrollStop);
          elem.scrolling = false;
        }
        if (elem.blurring) {
          //not checking hysteresis here, as this is a definite stop
          elem.dispatchEvent(options.events.blurStop);
          elem.blurring = false;
        }
      }, ((horizontal ? (elem.scrollLeft % elem.offsetWidth === 0) : (elem.scrollTop % elem.offsetHeight === 0)) ? 0 : 150));
    })

    //listen for created events, and do cosmetics & blur handling
    elem.addEventListener('scrollStart', (e) => {
      elem.classList.add('hnl-scrolling');
    })
    elem.addEventListener('blurStart', (e) => {
      //the actual motion blur is applied here
      options.filter.adjust(elem.blurAmount, options.scrollDirection);
      elem.classList.add('hnl-motionblurring');
    })
    elem.addEventListener('blurring', (e) => {
      //the actual motion blur is applied here
      options.filter.adjust(elem.blurAmount, options.scrollDirection);
    })
    elem.addEventListener('blurStop', (e) => {
      //options.filter.adjust(0, options.scrollDirection);
      elem.classList.remove('hnl-motionblurring');
    })
    elem.addEventListener('scrollStop', (e) => {
      elem.classList.remove('hnl-scrolling');
    })
  })
}