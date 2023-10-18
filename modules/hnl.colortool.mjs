/**
 * Color tool for generating and adjusting colors
 * v4.1 - ES6 module compliance
 * (C)2021-2022 Klaas Leussink
 *
 * Usage:
 *
 * let MyColorTool = new ColorTool(degsteps, startsat, startbri, startdeg, gradsteps, [paletlim])
 *
 * degsteps: 0-360    amount of degrees each new() color rotates
 * startsat: 0-100    amount of saturation to begin with (stays the same unless adjusted)
 * startbri: 0-100    amount of brightness to begin with (decreases with every full 360 degree hue cycle, see 'bricurce')
 * startdeg: 0-360    degrees to start with
 * gradsteps: 1-999   offset to add for each full cycle. Useful when going full cycles (360 % degsteps being 0)
 * paletlim: [0, 360] start-end degrees to confine color generation to
 *
 * Examples:
 *
 * let color = new ColorTool(68, 100, 95, 0, 0, 10);  initializes a new colortool with basic settings (see above)
 *
 * color.new().string                 gets a new color iteration as a string (returns as rgb if no transparency)
 * color.new().hex                    gets a new color iteration as a HEX string
 * color.new(100, 100).string         gets a new color iteration but overriding brightness, saturation
 * color.contra                       gets the current color iteration's CONTRAsting color (white or black, for contrasting text)
 * color.adjust({bri: 0.7}).string    gets the current color iteration, but returns with adjusted brightness without modifying the iteration
 * color.adjust({opa: 0.85}).string   gets the current color iteration, but returns with adjusted opacity without modifying the iteration
 * color.adjust({sat: 50}).string     gets the current color iteration, but returns with adjusted saturation without modifying the iteration
 * color.adjust({deg: 90}).string     gets the current color iteration, but returns with adjusted hue degrees without modifying the iteration
 *
 */

class ColorTool {

  constructor(degsteps, startsat, startbri, startdeg, gradsetps, paletlimit) {
    this.startdeg = startdeg ? startdeg : 0;
    this.degsteps = degsteps ? degsteps : 60; //gets you the primary colors on every new() cycle
    this.startsat = startsat ? startsat : 100;
    this.startbri = startbri ? startbri : 100;
    this.gradsteps = gradsetps && (gradsetps > 1) ? gradsetps : 10;
    this.paletlim = paletlimit ? paletlimit : [0, 360];
    this.skipgreen = false;
    this.calls = 0;
    this.color = null;
    this.deg = 0;
    this.cyc = 0;
    this.bri = 100;
    this.sat = 100;
    this.opa = 1;
  }

  _stringToDegrees(string) {
    let stringUniqueHash = [...string].reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    return Math.abs(stringUniqueHash) % 360;
  }

  _textContrast(rgb) {
    // http://www.w3.org/TR/AERT#color-contrast
    // Gets YIQ ratio
    const brightness = Math.round(((parseInt(rgb[0]) * 299) +
      (parseInt(rgb[1]) * 587) +
      (parseInt(rgb[2]) * 114)) / 1000);
    return (brightness > 125) ? 'rgb(0,0,0)' : 'rgb(255,255,255)';
  }

  _componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  _rgbToHex(rgb) {
    return "#" + this._componentToHex(rgb[0]) + this._componentToHex(rgb[1]) + this._componentToHex(rgb[2]);
  }

  _hexToRgb(h) {
    return h.match(/\w\w/g).map(x => +`0x${x}`);
  }

  _hexToHSL(H) {
    // Convert hex to RGB first
    let rgb = this._hexToRgb(H);
    // Then to HSL
    let r = rgb[0] / 255;
    let g = rgb[1] / 255;
    let b = rgb[2] / 255;
    let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin,
      h = 0,
      s = 0,
      l = 0;

    if (delta === 0)
      h = 0;
    else if (cmax === r)
      h = ((g - b) / delta) % 6;
    else if (cmax === g)
      h = (b - r) / delta + 2;
    else
      h = (r - g) / delta + 4;

    h = Math.round(h * 60);

    if (h < 0)
      h += 360;

    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return [h, s, l];
  }

  _hsl2hsv(hsl) {
    const hsv1 = hsl[1] * (hsl[2] < 50 ? hsl[2] : 100 - hsl[2]) / 100;
    const hsvS = hsv1 === 0 ? 0 : 2 * hsv1 / (hsl[2] + hsv1) * 100;
    const hsvV = hsl[2] + hsv1;
    return [hsl[0], hsvS, hsvV];
  }

  _HSVtoRGB(h, s, v, a) {
    h /= 360;
    s /= 100;
    v /= 100;
    a = (typeof a !== 'undefined') ? parseFloat(a) : undefined;
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
      s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        r = v, g = t, b = p;
        break;
      case 1:
        r = q, g = v, b = p;
        break;
      case 2:
        r = p, g = v, b = t;
        break;
      case 3:
        r = p, g = q, b = v;
        break;
      case 4:
        r = t, g = p, b = v;
        break;
      case 5:
        r = v, g = p, b = q;
        break;
    }
    let rgb = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    let type = 'rgb';
    if (typeof a !== 'undefined') {
      rgb.push(a);
      type = 'rgba';
    }
    return {
      values: rgb,
      string: type + '(' + rgb.join(',') + ')',
      hex: this._rgbToHex(rgb),
      contra: this._textContrast(rgb),
      textContrast: this._textContrast
    };
  }

  doColor(b, s) {

    let supplied = false;
    if (typeof b === 'string') {
      //string was passed
      if (b[0] === '#') {
        //color was passed as hex
        let hsv = this._hsl2hsv(this._hexToHSL(b));
        this.deg = hsv[0];
        this.sat = hsv[1];
        this.bri = hsv[2];
        supplied = true;
      } else {
        //generate color based on passed string
        this.deg = this._stringToDegrees(b);
      }
    } else {
      this.startdeg = this.startdeg < this.paletlim[0] ? this.paletlim[0] : this.startdeg;
      this.deg = this.startdeg + (this.calls * this.degsteps);
    }

    this.cyc = Math.floor(this.deg / this.paletlim[1]);

    if (!supplied) {
      this.bri = (b && b > 0) ? b : this.startbri;
      this.sat = (s && s > 0) ? s : this.startsat;
      this.bri = Math.abs(this.bri % 101);
      this.sat = Math.abs(this.sat % 101);
      this.deg = (this.deg % (this.paletlim[1] + 1));
      this.deg = this.deg < this.paletlim[0] ? this.paletlim[0] : this.deg;

      if (this.paletlim[0] % this.degsteps === 0 && this.cyc > 0) {
        //Doing full hue cycles. To prevent cycling to duplicate colors with each new cycle,
        //choose a mitigation: brightness, saturation, extra degrees...

        let factor = (this.cyc * this.gradsteps);

        this.altbri = (b && b > 0) ? b : (this.startbri - factor);
        this.altsat = (s && s > 0) ? s : (this.startsat - factor);
        this.altdeg = this.deg + (this.degsteps / (this.cyc + 1));
        this.altdeg = this.altdeg < this.paletlim[0] ? this.altdeg - this.paletlim[0] : this.altdeg;

        //this.sat = this.altsat;
        this.bri = this.altbri;
        //this.deg = this.altdeg;

        //keep cycling, alter steps
        if (factor >= 100) {
          this.cyc = 0;
          this.gradsteps = this.gradsteps / 2;
        }
      }
      //90 - 180 is problematic, as this is mostly indiscernible green. Pass to next cycle
      //this.skipgreen = (this.deg >= 90 && this.deg <= 180);
    }

    return this._HSVtoRGB(this.deg, this.sat, this.bri);
  }

  new(b, s) {
    this.color = this.doColor(b, s);
    this.string = this.color.string;
    this.values = this.color.values;
    this.contra = this.color.contra;
    this.hex = this._rgbToHex(this.color.values);

    this.calls++;

    return this;
  }

  adjust(what) {
    let sat, bri, deg, opa,
      d = (typeof what.deg !== 'undefined') ? what.deg : 0,
      s = (typeof what.sat !== 'undefined') ? what.sat : this.sat,
      b = (typeof what.bri !== 'undefined') ? what.bri : this.bri,
      a = (typeof what.opa !== 'undefined') ? what.opa : this.opa;

    deg = (this.deg + d) % this.paletlim[1];
    bri = (b <= 1 && b > 0) ? (this.bri * b) : b;
    sat = (s <= 1 && s > 0) ? (this.sat * s) : s;
    opa = (a < 0) ? 0 : ((a > 1) ? 1 : a);

    bri = bri > 100 ? 100 : (bri < 0) ? 0 : bri;
    sat = sat > 100 ? 100 : (sat < 0) ? 0 : sat;

    return this._HSVtoRGB(deg, sat, bri, opa);
  }
}

export default new ColorTool