import ColorTool from "./hnl.colortool.mjs";

const ENABLED = window.location.search.includes('debug=true'); //logger enabled??

function _processMessage(message) {
  return '%c' + [].slice.call(message).join('%c');
}

function _logColor(input) {
  const colorBase = ColorTool.new(input);
  return `color:${colorBase.contra};background-color:${colorBase.string};background-image:linear-gradient(0deg,${colorBase.adjust({bri: 0.85}).string} 0%, ${colorBase.adjust({bri: 1}).string} 100%);padding:3px 5px;margin-right:5px;border-radius:4px;`;
}

export const hnlLogger = {
  log: function (type, message) {
    ENABLED ? console.log((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      _logColor(type),
      (typeof message === 'object') ? message : 'color:black;'
    ) : true;
  },
  info: function (type, message) {
    ENABLED ? console.info((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      _logColor(type),
      (typeof message === 'object') ? message : 'color:#1e529e;'
    ) : true;
  },
  warn: function (type, message) {
    ENABLED ? console.warn((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      _logColor(type),
      (typeof message === 'object') ? message : 'color:#fd7e14;'
    ) : true;
  },
  error: function (type, message) {
    ENABLED ? console.error((typeof type === 'object') ? type :
        _processMessage((typeof message === 'object') ? [type] : arguments),
      _logColor(type),
      (typeof message === 'object') ? message : 'color:red;'
    ) : true;
  },
}