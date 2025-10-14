/**
 * @fileoverview Math Utilities - Time conversion, bezier curves, random numbers
 * @module util.math
 * @version 1.1.0
 * @author hnldesign
 * @since 2022
 */

export const NAME = 'math';

/**
 * Regex for detecting seconds suffix.
 * @private
 * @constant {RegExp}
 */
const SECONDS_REGEX = /\ds$/;

/**
 * Converts CSS time string to milliseconds.
 *
 * @param {string} s - Time string (e.g., '1s', '500ms', '1.5s')
 * @returns {number} Time in milliseconds
 *
 * @example
 * toMS('1s');      // → 1000
 * toMS('500ms');   // → 500
 * toMS('1.5s');    // → 1500
 * toMS('0.25s');   // → 250
 */
export function toMS(s) {
    return parseFloat(s) * (SECONDS_REGEX.test(s) ? 1000 : 1);
}

/**
 * Calculates Y coordinate on cubic Bezier curve at parameter t.
 * Uses Newton-Raphson method for X→t conversion.
 *
 * @param {number[]} controlPoints - Four control points [x1, y1, x2, y2]
 * @param {number} t - Parameter value (0-1)
 * @returns {number} Y coordinate at t
 *
 * @example
 * // Ease-in-out curve at halfway point
 * cubicBezier([0.42, 0, 0.58, 1], 0.5); // → ~0.5
 *
 * @example
 * // Ease-out curve at 25% through animation
 * cubicBezier([0, 0, 0.58, 1], 0.25); // → ~0.44
 */
export function cubicBezier(controlPoints, t) {
    const [x1, y1, x2, y2] = controlPoints;

    // Bezier basis coefficients
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    /**
     * Sample X coordinate on curve.
     * @private
     */
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;

    /**
     * Sample Y coordinate on curve.
     * @private
     */
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;

    /**
     * Solve for t parameter given X coordinate.
     * Uses Newton-Raphson iteration.
     * @private
     */
    const solveX = (x, epsilon) => {
        let t2 = x;

        for (let i = 0; i < 8; i++) {
            const x2 = sampleX(t2) - x;
            if (Math.abs(x2) < epsilon) {
                return t2;
            }

            const d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
            if (Math.abs(d2) < 1e-6) {
                break;
            }

            t2 -= x2 / d2;
        }

        return t2;
    };

    // Convert t parameter to Y coordinate
    const tResolved = solveX(t, 1e-6);
    return sampleY(tResolved);
}

/**
 * Generates random integer in range [min, max] (inclusive).
 *
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 *
 * @example
 * getRandomInt(1, 6);     // → Dice roll (1-6)
 * getRandomInt(0, 100);   // → Percentage (0-100)
 * getRandomInt(-10, 10);  // → Signed range
 */
export function getRandomInt(min, max) {
    const minInt = Math.ceil(min);
    const maxInt = Math.floor(max);
    return Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt;
}
