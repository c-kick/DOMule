/**
 * Slider handler v1.1 (12-2022)
 * (C) hnldesign 2022
 *
 * Handles slide & change events for HTML5 input type 'range' sliders.
 * on slide & change, the element's '--slider-value' css variable is updated with the current PERCENTUAL value of the slider (max and/or min are taken into account)
 *
 * Usage: <input type="range" class="bmi-range" id="customRange2" data-requires="./modules/hnl.slider" data-target="customRange2-display">
 * Optional: 'data-target' attribute; set to id of element that will receive the slider's value whenever its updated.
 *
 */
import {debounceThis} from './hnl.debounce';
import {hnlLogger} from "./hnl.logger";

const NAME = 'sliderHandler';

export function init(sliders, parent, changeCallback) {
  let slidersObject = {};
  sliders.forEach(function (slider) {

    //treat the combined slider + target as a single object
    const sliderObject = {
      element: slider,
      name: slider.name.toString(), //determine the slider's range. Note that any 'min' set needs to be reduced from the slider's value to get the right percentual value.
      range: ((slider.max ? slider.max : 100) - (slider.min ? slider.min : 0)) || 100,
      value: slider.value, //get the target, if provided
      tgt: slider.dataset.target ? document.getElementById(slider.dataset.target) : null,  //is slider control linked to the target?
      targetControl: (slider.dataset.target && slider.dataset.targetControl) || false,
      siblings: sliders,
      parent : (parent ? parent : null),
      trigger: 'self',
      update: debounceThis((event) => {
          //get value from either event or event as parameter (string or number)
          sliderObject.value = (typeof event === 'string' || typeof event === 'number') ? parseFloat(event) : event.target.value;

          if (event.target && event.target === sliderObject.element) {
            sliderObject.trigger = 'self';
            //updating self
            if (sliderObject.targetControl) {
              sliderObject.tgt.value = sliderObject.tgt.innerHTML = sliderObject.value;
            }
          } else if (event.target && event.target === sliderObject.tgt) {
            sliderObject.trigger = 'target';
            //updated by target
            sliderObject.element.value = sliderObject.value;
          } else {
            sliderObject.trigger = 'external';
            //updated by external (event or string or number)
            if (sliderObject.targetControl) {
              sliderObject.tgt.value = sliderObject.tgt.innerHTML = sliderObject.value;
            }
            sliderObject.element.value = sliderObject.value;
          }
          //update slider's --slider-value css value to current value of slider
          slider.style.setProperty('--slider-value', (((sliderObject.value - (slider.min ? slider.min : 0)) / sliderObject.range) * 100).toFixed(2) + '%');

          //trigger any callback provided
          if (typeof changeCallback === 'function') {
            changeCallback.call(this, sliderObject);
          }
          //trigger the custom update event
          slider.dispatchEvent(new Event('slider-change', {bubbles: true, data: {slider: sliderObject}}));

        }, {threshold: 10, execFirst: false, execWhile: true, execLast: true}),
      valueToPercentage : function(value) {
        value = parseFloat(value);
        return (((value - (slider.min ? slider.min : 0)) / sliderObject.range) * 100);
      }
    }

    //setup listeners for slide & change events on the slider (and target)
    sliderObject.element.addEventListener('input', sliderObject.update);
    sliderObject.element.addEventListener('change', sliderObject.update);

    //if target control, also listen there
    if (sliderObject.targetControl) {
      //sliderObject.tgt.addEventListener('change', sliderObject.update);
      sliderObject.tgt.addEventListener('input', sliderObject.update);
    }
    //on init, also update slider's --slider-value css value to current value of slider
    slider.style.setProperty('--slider-value', sliderObject.valueToPercentage(sliderObject.element.value).toFixed(2) + '%');

    //return objects for reference
    slider.slider = sliderObject;
    slidersObject[sliderObject.name] = sliderObject;
    hnlLogger.log(NAME, `Slider ${sliderObject.name} has been set-up`);
  });
  return slidersObject;
}
