/**
 * BMI Calculator v5.1 (5-2023)
 * (C) hnldesign 2010-2023
 *
 * Calculates BMI using either length (and BMI) or weight (and BMI) as an input, returns length, weight and BMI again.
 *
 */
;
import {hnlLogger} from "./hnl.logger";

const NAME = 'bmiCalculator';

/**
 * Calculates BMI based on height and weight or updates BMI based on change in height or weight
 * @param {object} data - Contains the length, weight and bmi
 * @param {string} change - Indicates whether the height or weight is changing
 * @returns {object} - Object with updated length, weight, and bmi
 */
export function calculateBMI(data, change) {

    let dataIn = {
        length :    data['length'] ?   parseFloat(data['length']) :   0,
        weight :    data['weight'] ?   parseFloat(data['weight']) :   0,
        bmi :       data['bmi'] ?      parseFloat(data['bmi']) :      0,
        change :    change
    };

    if (((dataIn.length !== null || dataIn.weight !== null) && dataIn.bmi !== null) && change) {
        const dataOut = { ...dataIn };

        if (dataIn.length > 0 && change === 'bmi') {
            dataOut.weight = dataIn.bmi * Math.pow((dataIn.length / 100), 2);
        } else if (dataIn.weight > 0 && change === 'bmi') {
            dataOut.length = Math.sqrt(dataIn.weight/dataIn.bmi) * 100;
        }
        dataOut.bmi = (dataOut.weight && dataOut.length) ? dataOut.weight/Math.pow((dataOut.length / 100), 2) : 0;

        return dataOut;
    } else {
        hnlLogger.warn(NAME, 'Warning: not enough data for calculation:');
        hnlLogger.warn(NAME, data);
        return dataIn;
    }
}

/**
 * Calculates the lower and higher bounds and difference for a given length and weight using BMI cutoffs
 * @param {Array<number>} bmiCutoffs - Contains the lower and upper BMI cutoff values
 * @param {number} length - Height in centimeters
 * @param {number} weight - Weight in kilograms
 * @returns {object} - Object with lower bound, higher bound, and difference
 */
export function weightForLength(bmiCutoffs, length, weight) {
    const [lowerBound, higherBound] = bmiCutoffs.map(bmi => bmi * ((length / 100) ** 2));
    const difference = Math.max(lowerBound - weight, weight - higherBound);

    return { low: lowerBound, high: higherBound, diff: difference };
}