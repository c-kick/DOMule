/**
 * @fileoverview Color Tool - Deterministic color generation and manipulation
 * @module util.color
 * @version 4.2.0
 * @author hnldesign
 * @since 2021
 *
 * @description
 * Provides deterministic color generation from strings or numeric sequences,
 * with support for hue cycling, brightness/saturation adjustment, and
 * color space conversions (RGB, HSV, HSL, HEX).
 *
 * Used by core.log.mjs for consistent module badge colors.
 *
 * @example
 * import ColorTool from './util.color.mjs';
 *
 * // Sequential color generation
 * const tool = new ColorTool(60, 100, 95, 0, 10, [0, 360]);
 * const color1 = tool.new().string; // 'rgb(242,95,95)'
 * const color2 = tool.new().hex;    // '#f25f5f'
 *
 * @example
 * // String-based deterministic colors
 * const tool = new ColorTool();
 * const moduleColor = tool.new('myModule').string; // Same color every time
 *
 * @example
 * // Adjust existing color
 * const tool = new ColorTool();
 * tool.new();
 * const darker = tool.adjust({bri: 0.7}).string;
 * const opaque = tool.adjust({opa: 0.5}).string;
 */

export const NAME = 'color';

// ============================================================================
// CONSTANTS
// ============================================================================

/** @private YIQ color space constants for perceived brightness calculation */
const YIQ_RED_WEIGHT = 299;
const YIQ_GREEN_WEIGHT = 587;
const YIQ_BLUE_WEIGHT = 114;
const YIQ_DIVISOR = 1000;
const YIQ_THRESHOLD = 125;

/** @private Default configuration */
const DEFAULTS = {
  degsteps: 60,      // Primary colors on each cycle
  startsat: 100,     // Full saturation
  startbri: 100,     // Full brightness
  startdeg: 0,       // Start at red
  gradsteps: 10,     // Brightness reduction per cycle
  paletlim: [0, 360] // Full hue range
};

// ============================================================================
// COLOR TOOL CLASS
// ============================================================================

/**
 * Color generation and manipulation tool.
 * Maintains internal state for sequential color generation.
 *
 * @class
 * @param {number} [degsteps=60] - Hue rotation per new() call (0-360)
 * @param {number} [startsat=100] - Initial saturation (0-100)
 * @param {number} [startbri=100] - Initial brightness (0-100)
 * @param {number} [startdeg=0] - Starting hue degrees (0-360)
 * @param {number} [gradsteps=10] - Brightness reduction per full cycle
 * @param {[number, number]} [paletlim=[0,360]] - Hue range [min, max]
 *
 * @example
 * // Generate primary colors (60° apart)
 * const tool = new ColorTool(60, 100, 100);
 * tool.new().string; // Red
 * tool.new().string; // Yellow
 * tool.new().string; // Green
 *
 * @example
 * // Constrained to warm colors
 * const warm = new ColorTool(30, 100, 100, 0, 10, [0, 60]);
 * warm.new().string; // Red-orange range
 */
class ColorTool {
  constructor(degsteps, startsat, startbri, startdeg, gradsteps, paletlimit) {
    this.startdeg = startdeg ?? DEFAULTS.startdeg;
    this.degsteps = degsteps ?? DEFAULTS.degsteps;
    this.startsat = startsat ?? DEFAULTS.startsat;
    this.startbri = startbri ?? DEFAULTS.startbri;
    this.gradsteps = (gradsteps && gradsteps > 1) ? gradsteps : DEFAULTS.gradsteps;
    this.paletlim = paletlimit ?? DEFAULTS.paletlim;

    // State
    this.calls = 0;
    this.color = null;
    this.deg = 0;
    this.cyc = 0;
    this.bri = 100;
    this.sat = 100;
    this.opa = 1;
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Generate next color in sequence or from string.
   *
   * @param {number|string} [b] - Brightness override (0-100) or string seed
   * @param {number} [s] - Saturation override (0-100)
   * @returns {Object} Color object with string, hex, values, contra properties
   *
   * @example
   * const tool = new ColorTool();
   * tool.new().string;        // 'rgb(242,95,95)'
   * tool.new(50).string;      // 50% brightness
   * tool.new('myModule').hex; // '#a742f2' (deterministic)
   */
  new(b, s) {
    this.color = this._generateColor(b, s);
    this.string = this.color.string;
    this.values = this.color.values;
    this.contra = this.color.contra;
    this.hex = this._rgbToHex(this.color.values);

    this.calls++;
    return this;
  }

  /**
   * Adjust current color without modifying state.
   *
   * @param {Object} opts - Adjustment options
   * @param {number} [opts.deg] - Hue offset (-360 to 360)
   * @param {number} [opts.sat] - Saturation (0-100 or 0-1 multiplier)
   * @param {number} [opts.bri] - Brightness (0-100 or 0-1 multiplier)
   * @param {number} [opts.opa] - Opacity (0-1)
   * @returns {Object} Adjusted color object
   *
   * @example
   * const tool = new ColorTool();
   * tool.new();
   * tool.adjust({bri: 0.7}).string;  // 70% brightness
   * tool.adjust({deg: 30}).string;   // +30° hue shift
   * tool.adjust({opa: 0.5}).string;  // 50% opacity
   */
  adjust(opts) {
    const d = opts.deg ?? 0;
    const s = opts.sat ?? this.sat;
    const b = opts.bri ?? this.bri;
    const a = opts.opa ?? this.opa;

    const deg = (this.deg + d) % this.paletlim[1];
    const bri = this._clamp((b <= 1 && b > 0) ? (this.bri * b) : b, 0, 100);
    const sat = this._clamp((s <= 1 && s > 0) ? (this.sat * s) : s, 0, 100);
    const opa = this._clamp(a, 0, 1);

    return this._hsvToRgb(deg, sat, bri, opa);
  }

  // ========================================================================
  // PRIVATE COLOR GENERATION
  // ========================================================================

  /**
   * Core color generation logic.
   * @private
   * @param {number|string} [b] - Brightness or string seed
   * @param {number} [s] - Saturation
   * @returns {Object} Color object
   */
  _generateColor(b, s) {
    let supplied = false;

    // Handle string input
    if (typeof b === 'string') {
      if (b[0] === '#') {
        // Parse hex color
        const hsv = this._hslToHsv(this._hexToHsl(b));
        this.deg = hsv[0];
        this.sat = hsv[1];
        this.bri = hsv[2];
        supplied = true;
      } else {
        // Generate from string hash
        this.deg = this._stringToDegrees(b);
      }
    } else {
      // Sequential generation
      this.startdeg = Math.max(this.startdeg, this.paletlim[0]);
      this.deg = this.startdeg + (this.calls * this.degsteps);
    }

    this.cyc = Math.floor(this.deg / this.paletlim[1]);

    if (!supplied) {
      this.bri = (b && b > 0) ? b : this.startbri;
      this.sat = (s && s > 0) ? s : this.startsat;
      this.bri = Math.abs(this.bri % 101);
      this.sat = Math.abs(this.sat % 101);
      this.deg = this.deg % (this.paletlim[1] + 1);
      this.deg = Math.max(this.deg, this.paletlim[0]);

      // Handle full hue cycles - adjust brightness to avoid duplicates
      if (this.paletlim[0] % this.degsteps === 0 && this.cyc > 0) {
        const factor = this.cyc * this.gradsteps;

        this.bri = (b && b > 0) ? b : (this.startbri - factor);

        // Reset when brightness drops too low
        if (factor >= 100) {
          this.cyc = 0;
          this.gradsteps = this.gradsteps / 2;
        }
      }
    }

    return this._hsvToRgb(this.deg, this.sat, this.bri);
  }

  /**
   * Hash string to hue degrees (0-360).
   * Same string always produces same hue.
   * @private
   * @param {string} str - Input string
   * @returns {number} Hue degrees
   */
  _stringToDegrees(str) {
    const hash = [...str].reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(hash) % 360;
  }

  // ========================================================================
  // PRIVATE COLOR SPACE CONVERSIONS
  // ========================================================================

  /**
   * Convert HSV to RGB with optional opacity.
   * @private
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-100)
   * @param {number} v - Value/Brightness (0-100)
   * @param {number} [a] - Alpha/Opacity (0-1)
   * @returns {Object} Color object with string, values, hex, contra
   */
  _hsvToRgb(h, s, v, a) {
    h /= 360;
    s /= 100;
    v /= 100;
    a = (typeof a !== 'undefined') ? parseFloat(a) : undefined;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    const rgb = [
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    ];

    const type = typeof a !== 'undefined' ? 'rgba' : 'rgb';
    if (typeof a !== 'undefined') rgb.push(a);

    return {
      values: rgb,
      string: `${type}(${rgb.join(',')})`,
      hex: this._rgbToHex(rgb),
      contra: this._textContrast(rgb)
    };
  }

  /**
   * Convert hex to HSL.
   * @private
   * @param {string} hex - Hex color (#RRGGBB)
   * @returns {[number, number, number]} [hue, saturation, lightness]
   */
  _hexToHsl(hex) {
    const rgb = this._hexToRgb(hex);
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;

    const cmin = Math.min(r, g, b);
    const cmax = Math.max(r, g, b);
    const delta = cmax - cmin;

    let h = 0;
    if (delta !== 0) {
      if (cmax === r) h = ((g - b) / delta) % 6;
      else if (cmax === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const l = (cmax + cmin) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return [h, +(s * 100).toFixed(1), +(l * 100).toFixed(1)];
  }

  /**
   * Convert HSL to HSV.
   * @private
   * @param {[number, number, number]} hsl - [hue, saturation, lightness]
   * @returns {[number, number, number]} [hue, saturation, value]
   */
  _hslToHsv(hsl) {
    const hsv1 = hsl[1] * (hsl[2] < 50 ? hsl[2] : 100 - hsl[2]) / 100;
    const hsvS = hsv1 === 0 ? 0 : 2 * hsv1 / (hsl[2] + hsv1) * 100;
    const hsvV = hsl[2] + hsv1;
    return [hsl[0], hsvS, hsvV];
  }

  /**
   * Convert hex to RGB array.
   * @private
   * @param {string} hex - Hex color (#RRGGBB)
   * @returns {number[]} [r, g, b]
   */
  _hexToRgb(hex) {
    return hex.match(/\w\w/g).map(x => +`0x${x}`);
  }

  /**
   * Convert RGB to hex string.
   * @private
   * @param {number[]} rgb - [r, g, b]
   * @returns {string} Hex color (#RRGGBB)
   */
  _rgbToHex(rgb) {
    return '#' + rgb.slice(0, 3)
        .map(c => c.toString(16).padStart(2, '0'))
        .join('');
  }

  /**
   * Calculate contrasting text color (black or white).
   * Uses YIQ color space for perceived brightness.
   * @private
   * @param {number[]} rgb - [r, g, b]
   * @returns {string} 'rgb(0,0,0)' or 'rgb(255,255,255)'
   */
  _textContrast(rgb) {
    const brightness = Math.round((
        parseInt(rgb[0]) * YIQ_RED_WEIGHT +
        parseInt(rgb[1]) * YIQ_GREEN_WEIGHT +
        parseInt(rgb[2]) * YIQ_BLUE_WEIGHT
    ) / YIQ_DIVISOR);

    return brightness > YIQ_THRESHOLD ? 'rgb(0,0,0)' : 'rgb(255,255,255)';
  }

  // ========================================================================
  // PRIVATE UTILITIES
  // ========================================================================

  /**
   * Clamp value between min and max.
   * @private
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  _clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Default ColorTool instance for convenience.
 * Used by core.log.mjs for consistent module badge colors.
 * @type {ColorTool}
 */
export default new ColorTool();