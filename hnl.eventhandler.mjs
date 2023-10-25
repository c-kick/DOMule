/**
 * Event handler v2.3 (4-2023)
 * (C) hnldesign 2022-2023
 *
 * Listens for events, provides ways to register and de-register event handlers
 * Uses imports! https://caniuse.com/es6-module
 * So transpile to a bundle for older browsers
 *
 * This module has no init, binds itself to window.eventHandler, and exports the handler
 *
 * Usage:
 * $__EventHandler.addListener('breakPointChange', function(e){
 *   console.log('breakPointChange', e);
 * });
 *
 * $__EventHandler.removeListener('breakPointChange', function(e){
 *   console.log('breakPointChange', e);
 * });
 *
 * or use the shorthands for some, see bottom of code
 *
 * Offers events:
 * docReady
 * breaKPointChange
 * startResize
 * resize (start, while and done resizing)
 * endResize
 * docBlur
 * docFocus
 * docShift (handles both resize and scroll in handler)
 * bodyResize (new in v2) - uses resizeObserver
 * scroll
 * startScroll
 * endScroll
 */
import {debounceThis} from './hnl.debounce.mjs';
import {hnlLogger} from "./hnl.logger.mjs";

const NAME = 'eventHandler';

class eventHandler {

  constructor() {
    const EventHandler = this;

    this._callbacks = {
      'docReady': {}, 'breakPointChange': {}, 'docShift': {},
      'startResize': {}, 'resize' : {}, 'endResize': {}, 'bodyResize': {},
      'docBlur': {}, 'docFocus': {},
      'scroll': {}, 'startScroll': {}, 'endScroll': {},
      'docLoaded' : {}
    }
    this._timestamps = {}

    //ready events
    if (document.readyState !== "loading") {
      hnlLogger.info(NAME, 'Document is ready.');
      EventHandler._runListeners(['docReady', 'docShift']);
      document.eventHandlerBusy = false;
    } else {
      window.addEventListener("DOMContentLoaded", function (e) {
        hnlLogger.info(NAME, 'Document is ready.');
        EventHandler._runListeners(['docReady', 'docShift'], e);
        document.eventHandlerBusy = false;
      });
    }
    window.addEventListener("load", function (e) {
      hnlLogger.info(NAME, 'Page is fully loaded.');
      EventHandler._runListeners(['docLoaded'], e);
    });

    //responsive events
    document.addEventListener('breakPointChange', function breakPointChanged(e) {
      if (e.detail.matches) {
        hnlLogger.info(NAME, 'Breakpoint matched: ' + e.detail.name);
      }
      EventHandler._runListeners(['breakPointChange'], e);
    })
    //now import the breakpoint handler, which triggers the breakPointChange event
    import('./hnl.breakpoints.mjs');

    //debounced resize events
    window.addEventListener('resize', debounceThis((e)=> {
      hnlLogger.info(NAME, 'Resizing.');
      EventHandler._timestamps['resize'] = Date.now();
      EventHandler._runListeners(['resize'], e);
      document.eventHandlerBusy = true;
    }, {execStart: true, execWhile: true, execDone: true}));
    window.addEventListener('resize', debounceThis((e)=> {
      hnlLogger.info(NAME, 'Resize started.');
      EventHandler._timestamps['resize'] = Date.now();
      EventHandler._runListeners(['startResize'], e);
      document.eventHandlerBusy = true;
    }, {execStart: true, execWhile: false, execDone: false}));
    window.addEventListener('resize', debounceThis((e)=> {
      e.TimeTaken = Date.now() - EventHandler._timestamps['resize'];
      hnlLogger.info(NAME, 'Resize ended. (took ' + e.TimeTaken + 'ms)');
      EventHandler._runListeners(['endResize', 'docShift'], e);
      document.eventHandlerBusy = false;
    }, {execStart: false, execWhile: false, execDone: true}));
    (new ResizeObserver(debounceThis((e) => {
      //hnlLogger.info(NAME, 'Body resized: ' + e[0].target.clientHeight);
      EventHandler._runListeners(['docShift', 'bodyResize'], e);
    }, {execStart: false, execWhile: false, execDone: true, threshold: 150} ))).observe(document.body);

    //debounced scroll events
    window.addEventListener('scroll', debounceThis((e)=> {
      EventHandler._timestamps['scroll'] = Date.now();
      //hnlLogger.info(NAME, 'Scroll started.');
      EventHandler._runListeners(['startScroll'], e);
      document.eventHandlerBusy = true;
    }, {execStart: true, execWhile: false, execDone: false}));
    window.addEventListener('scroll', debounceThis((e)=> {
      //hnlLogger.info(NAME, 'Scrolling.');
      EventHandler._runListeners(['scroll', 'docShift'], e);
    }, {execStart: false, execWhile: true, execDone: false, threshold: 100}));
    window.addEventListener('scroll', debounceThis((e)=> {
      e.TimeTaken = Date.now() - EventHandler._timestamps['scroll'];
      //hnlLogger.info(NAME, 'Scroll ended. (took ' + e.TimeTaken + 'ms)');
      EventHandler._runListeners(['endScroll'], e);
      document.eventHandlerBusy = false;
    }, {execStart: false, execWhile: false, execDone: true}));

    //document visibility events
    (function visibilityChanged() {
      let docHidden = (typeof document.hidden !== "undefined");
      let hidden = docHidden ? "hidden" : "msHidden";
      let visibilityChange = docHidden ? "visibilitychange" : "msvisibilitychange";
      let document_hidden = document[hidden];
      document.addEventListener(visibilityChange, function (e) {
        if (document_hidden !== document[hidden]) {
          if (document[hidden]) {
            EventHandler._timestamps['visibility'] = Date.now();
            hnlLogger.info(NAME, 'Document lost focus.');
            EventHandler._runListeners(['docBlur', 'docShift'], e);
            document.eventHandlerBusy = false;
          } else {
            e.TimeTaken = Date.now() - EventHandler._timestamps['visibility'];
            hnlLogger.info(NAME, 'Document regained focus. (took ' + e.TimeTaken + 'ms)');
            EventHandler._runListeners(['docFocus', 'docShift'], e);
          }
          document_hidden = document[hidden];
        }
      });
    }());
  }

  //private

  _hashCode(string) {
    var hash = 0;
    for (var i = 0; i < string.length; i++) {
      var char = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  _runListeners(events, origEvent) {
    let callBacks = this._callbacks;
    events.forEach(function(event){
      for (let id in callBacks[event]) {
        if (callBacks[event].hasOwnProperty(id)) {
          let cb = callBacks[event][id];
          if (typeof (cb) === 'function') {
            cb.call(this, origEvent);
          }
        }
      }
    })
  }

  //public

  addListener(event, callback) {
    if (!this._callbacks[event]) {
      hnlLogger.warn(NAME, 'No such event! (' + event + ')');
      return function(){};
    } else {
      if ((event === 'docReady') && document.readyState !== 'loading') {
        //if this is a document ready callback, and the document is already done, call it immediately
        callback.call(this);
      } else {
        if (event === 'docShift' && document.readyState !== 'loading') {
          //same goes for layout shift events, thouugh they still need to register
          callback.call(this);
        }
        let id = this._hashCode(callback.toString());
        if (typeof this._callbacks[event][id] === 'function') {
          hnlLogger.warn(NAME, 'Callback already assigned to event, skipping...');
          hnlLogger.warn(NAME, event);
        } else {
          this._callbacks[event][id] = callback;
        }
      }
    }
    return callback; //return the callback for immediate invocation after binding
  }

  removeListener(event, callback) {
    if (!this._callbacks[event]) {
      hnlLogger.warn(NAME, 'No such event! (' + event + ')');
      return false;
    } else {
      let id = this._hashCode(callback.toString());
      if (this._callbacks[event][id]) {
        delete this._callbacks[event][id];
      }
    }
  }

  //shorthand
  docLoaded(callback) {
    return this.addListener('docLoaded', callback);
  }

  //shorthand
  docReady(callback) {
    return this.addListener('docReady', callback);
  }

  docShift(callback) {
    return this.addListener('docShift', callback);
  }

  breakPointChange(callback) {
    return this.addListener('breakPointChange', callback);
  }
}

//allow only one instance to prevent double binding
window.eventHandler = window.eventHandler ? window.eventHandler : new eventHandler();
export default window.eventHandler
//export {EventHandler as default};