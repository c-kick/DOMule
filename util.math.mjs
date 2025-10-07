export const NAME = 'math';

/**
 * Convert string (e.g. '1s') to milliseconds
 * Source: https://stackoverflow.com/questions/30439694/converting-jquerys-css-timing-to-ms
 */
export function toMS(s) {
    return parseFloat(s) * (/\ds$/.test(s) ? 1000 : 1);
}

/**
 * Calculate the y-coordinate of a cubic Bezier curve at a given t parameter.
 *
 * @param {number[]} controlPoints - An array of four control points [x1, y1, x2, y2].
 * @param {number} t - The parameter value ranging from 0 to 1.
 * @returns {number} - The y-coordinate of the cubic Bezier curve at the specified t.
 */
export function cubicBezier(controlPoints, t) {
    const [x1, y1, x2, y2] = controlPoints;

    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    /**
     * Calculate the x-coordinate of the cubic Bezier curve at a given t parameter.
     *
     * @param {number} t - The parameter value ranging from 0 to 1.
     * @returns {number} - The x-coordinate of the cubic Bezier curve at the specified t.
     */
    function sampleCurveX(t) {
        return ((ax * t + bx) * t + cx) * t;
    }

    /**
     * Solve for the t parameter corresponding to a given x-coordinate on the curve.
     *
     * @param {number} x - The x-coordinate to solve for.
     * @param {number} epsilon - The tolerance for the solution.
     * @returns {number} - The t parameter corresponding to the specified x-coordinate.
     */
    function solveCurveX(x, epsilon) {
        let t2 = x, d2, i;

        for (i = 0; i < 8; i++) {
            const x2 = sampleCurveX(t2) - x;
            if (Math.abs(x2) < epsilon) {
                return t2;
            }

            d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
            if (Math.abs(d2) < 1e-6) {
                break;
            }

            t2 -= x2 / d2;
        }

        const t1 = t2 - x2 / d2;
        return t1;
    }

    /**
     * Calculate the y-coordinate of the cubic Bezier curve at a given t parameter.
     *
     * @param {number} t - The parameter value ranging from 0 to 1.
     * @returns {number} - The y-coordinate of the cubic Bezier curve at the specified t.
     */
    function sampleCurveY(t) {
        return ((ay * t + by) * t + cy) * t;
    }

    const t1 = solveCurveX(t, 1e-6);
    return sampleCurveY(t1);
}

/**
 * Generates a random integer between the specified minimum (inclusive) and maximum (inclusive) values.
 *
 * @param {number} min - The minimum value for the random integer.
 * @param {number} max - The maximum value for the random integer.
 * @returns {number} A random integer between min and max (inclusive).
 */
export function getRandomInt(min, max) {
    // Ensure min and max are integers
    min = Math.ceil(min);
    max = Math.floor(max);

    // Generate and return a random integer
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
