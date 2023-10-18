/**
 * NOK BMI Calculator module v1.0 (12-2022)
 * (C) hnldesign 2010-2022
 *
 */

;
import {calculateBMI, weightForLength} from "./hnl.bmicalculator";
import {init as setUpSliders} from "./hnl.slider";

const NAME = 'nokBMICalc';

const InclusieCriteria = {
  //treatment: [lowerlimit, upperlimit (optional)]
  pz : [27],
  regulier : [35],
}

const BMICutoffValues = {
  volwassenen: [18.50, 25, 30, 40],
  kinderen: {
    meisjes : {
      2 :   [14.74, 18, 19.8, 23.4],
      3 :   [14.38, 17.6, 19.4, 23.2],
      4 :   [14.15, 17.3, 19.2, 23.5],
      5 :   [13.97, 17.2, 19.2, 24.2],
      6 :   [13.92, 17.3, 19.7, 25.5],
      7 :   [14, 17.8, 20.5, 27.4],
      8 :   [14.16, 18.4, 21.6, 29.8],
      9 :   [14.42, 19.1, 22.8, 32.3],
      10 :  [14.78, 19.9, 24.1, 34.6],
      11 :  [15.25, 20.7, 25.4, 36.5],
      12 :  [15.83, 21.7, 26.7, 38],
      13 :  [16.43, 22.6, 27.8, 38.9],
      14 :  [17, 23.3, 28.6, 39.4],
      15 :  [17.52, 23.9, 29.1, 39.7],
      16 :  [17.95, 24.4, 29.4, 39.9],
      17 :  [18.33, 24.7, 29.7, 39.9],
      18 :  [18.5, 25, 30, 40]
    },
    jongens: {
      2 :   [14.95, 18.4, 20.1, 23.6],
      3 :   [14.54, 17.9, 19.6, 22.2],
      4 :   [14.30, 17.6, 19.3, 21.7],
      5 :   [14.12, 17.4, 19.3, 21.7],
      6 :   [14, 17.6, 19.8, 22.2],
      7 :   [14, 17.9, 20.6, 23.2],
      8 :   [14.20, 18.4, 21.6, 24.9],
      9 :   [14.41, 19.1, 22.8, 27],
      10 :  [14.69, 19.8, 24, 29.5],
      11 :  [15.03, 20.6, 25.1, 32.2],
      12 :  [15.47, 21.2, 26, 34.8],
      13 :  [15.98, 21.9, 26.8, 36.9],
      14 :  [16.54, 22.6, 27.6, 38.4],
      15 :  [17.13, 23.3, 28.3, 39.1],
      16 :  [17.70, 23.9, 28.9, 39.5],
      17 :  [18.24, 24.5, 29.4, 39.8],
      18 :  [18.5, 25, 30, 40]
    }
  }
}

function scoreInclusie($bmi) {
  let score = { add: [], rem: []};
  ['pz', 'regulier'].forEach(function(x){
    if (parseFloat($bmi) >= InclusieCriteria[x][0] && (InclusieCriteria[x][1] ? parseFloat($bmi) < InclusieCriteria[x][1] : true)) {
      score.add.push(x);
    } else {
      score.rem.push(x);
    }
  });
  return score;
}

function updateCalc($slider) {
  let values = ({}), newValues, healthyWeight, currentCutoff = 0;

  if ($slider.trigger === 'external') return; //don't re-trigger if I caused the update event

  if ($slider.siblings) {
    //parse this input, and its siblings containing the other required parameters for calculation
    $slider.siblings.forEach(function (sibling) {
      //limit between min and max if defined
      //values[sibling.slider.name] = (sibling.slider.element.min && sibling.slider.element.max) ?
      //  Math.min(sibling.slider.element.max, Math.max(sibling.slider.element.min, sibling.slider.value)) :
      //  sibling.slider.value;
      values[sibling.slider.name] = sibling.slider.value;
    });
  }

  newValues = calculateBMI(values, $slider.name);

  //set the lower and upper ranges for a healthy weight, as well as the weight difference
  healthyWeight = weightForLength(BMICutoffValues.volwassenen, newValues.length, newValues.weight);
  $slider.parent.lowerWeight.forEach(function(x){
    x.innerHTML = Math.ceil(healthyWeight.low * 10) / 10;
  });
  $slider.parent.higherWeight.forEach(function(x){
    x.innerHTML = Math.floor(healthyWeight.high * 10) / 10;
  });
  $slider.parent.differenceWeight.forEach(function(x){
    let diff = Math.round(healthyWeight.diff * 10) / 10;
    x.innerHTML = diff;
    //hide sentence if weight difference is zero
    x.parentElement.classList.toggle('d-none', diff === 0);
  });
  BMICutoffValues.volwassenen.forEach(function(cutOffValue, i) {
    if (parseFloat(newValues.bmi) >= parseFloat(cutOffValue)) {
      currentCutoff = i + 1;
    }
  });

  if ($slider.parent) {
    //update parent styles
    $slider.parent.style.setProperty('--cutoff-color', 'var(--cutoff-color-' + currentCutoff + ')');
    let x = 5, rem = [], add = []; //5 'sectors' in BMI scoring
    while (x--) {
      if (x !== currentCutoff) {
        rem.push('conclusion-' + x);
      } else {
        add.push('conclusion-' + x);
      }
    }
    //score inclusiecriteria
    let inclusie = scoreInclusie(newValues.bmi);
    //set/unset classes
    $slider.parent.classList.remove(...rem.concat(inclusie.rem));
    $slider.parent.classList.add(...add.concat(inclusie.add));
  }

  if ($slider.siblings) {
    //update siblings
    $slider.siblings.forEach(function (sibling) {
      if ((sibling.slider.name === newValues.change)) return; //don't update the input that was changed
      sibling.slider.update(Math.round(newValues[sibling.name.toString()] * 10) / 10);
    });
  }
}

export function init(divs) {
  divs.forEach(function (div) {
    div.sliders = setUpSliders(div.querySelectorAll('input[type=range]'), div, updateCalc);
    div.classList.add('conclusion-1'); //default
    div.lowerWeight = div.querySelectorAll('span.healthy-weight-low');
    div.higherWeight = div.querySelectorAll('span.healthy-weight-high');
    div.differenceWeight = div.querySelectorAll('span.healthy-weight-difference');

    BMICutoffValues.volwassenen.forEach(function(cutoffValue, i) {
      div.style.setProperty(
        '--cutoff-' + i,
        div.sliders.bmi.valueToPercentage(parseFloat(cutoffValue)).toFixed(2) + '%'
      );
    });
  });

}