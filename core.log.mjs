import ColorTool from "./hnl.colortool.mjs";  // temporary
export const NAME = 'logger';

/**
 * Fancy console logger for logging module events.
 * (C) hnldesign 2022-2024
 *
 * - Keeps track of the debug flag (?debug=true) in the url to determine if logging should be output to the console
 * - Shows nicely structured and colored messages, and keeps these colors concise based on the name of the module
 *   that was passed, allowing for a better overview of what's happening and who's logging what.
 *
 * The logging semantic is similar to regular console logging, but with an extra parameter: the module's name.
 *
 * Example usage:
 * import {hnlLogger} from "./hnl.logger.mjs";
 * hnlLogger.log(NAME, 'Message'); - NAME is a mandatory const inside the module definition and should contain its name
 * hnlLogger.error(NAME, 'Error message');
 */

const ENABLED = window.location.search.includes('debug=true'); //logger enabled??

function _processMessage(message) {
    return '%c' + [].slice.call(message).join('%c');
}

const message_css = `font-family: Lucida Grande,Lucida Sans Unicode,Lucida Sans,Geneva,Verdana,sans-serif`

function _logColor(input) {
    const colorBase = ColorTool.new(input);
    return `color:${colorBase.contra};
  background-color:${colorBase.string};
  background-image:linear-gradient(0deg,${colorBase.adjust({deg: 10}).string} 0%, ${colorBase.adjust({opa: 1}).string} 100%);
  padding:3px 5px;margin-right:15px;border-radius:4px;`;
}


export const hnlLogger = {
    log: function (type, message) {
        ENABLED ? console.log((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:black;`
        ) : true;
    },
    info: function (type, message) {
        ENABLED ? console.info((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:#1e529e;`
        ) : true;
    },
    warn: function (type, message) {
        ENABLED ? console.warn((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:#fd7e14;`
        ) : true;
    },
    error: function (type, message) {
        ENABLED ? console.error((typeof type === 'object') ? type :
                _processMessage((typeof message === 'object') ? [type] : arguments),
            `${message_css}; ${_logColor(type)}`,
            (typeof message === 'object') ? message : `${message_css};color:red;`
        ) : true;
    },
}
export const logger = hnlLogger;  // alias for new API