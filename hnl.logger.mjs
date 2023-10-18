import ColorTool from "./hnl.colortool.mjs";

const ENABLED = window.location.search.includes('debug'); //logger enabled??

let cssLeftSide = 'padding:3px 5px;margin-right:5px;border-radius:2px;';

function _processMessage(message) {
  return '%c' + [].slice.call(message).join('%c');
}
function _logColor(input) {
  return ColorTool.new(input).adjust({bri: 0.9});
}

export const hnlLogger = {
  log: function (type, message) {
    ENABLED ? console.log((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      'color:' + _logColor(type).contra + ';background-color:' + _logColor(type).string + ';' + cssLeftSide,
      (typeof message === 'object') ? message : 'color:black;'
    ) : true;
  },
  info: function (type, message) {
    ENABLED ? console.info((typeof type === 'object') ? type :
      _processMessage((typeof message === 'object') ? [type] : arguments),
      'color:' + _logColor(type).contra + ';background-color:' + _logColor(type).string + ';' + cssLeftSide,
      (typeof message === 'object') ? message : 'color:#1e529e;'
    ) : true;
  },
  warn: function (type, message) {
    ENABLED ? console.warn((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      'color:' + _logColor(type).contra + ';background-color:' + _logColor(type).string + ';' + cssLeftSide,
      (typeof message === 'object') ? message : 'color:orange;'
    ) : true;
  },
  error: function (type, message) {
    ENABLED ? console.error((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      'color:' + _logColor(type).contra + ';background-color:' + _logColor(type).string + ';' + cssLeftSide,
      (typeof message === 'object') ? message : 'color:red;'
    ) : true;
  },
}