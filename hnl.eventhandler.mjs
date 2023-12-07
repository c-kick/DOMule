/**
 * Event handler v2.5 (12-2023)
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
 * imgsLoaded
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
 * breakPointChange - the only event that is allowed to run multiple times per cycle (animationFrame)
 */
import './hnl.polyfills.mjs';
import {debounceThis} from './hnl.debounce.mjs';
import {hnlLogger} from "./hnl.logger.mjs";

export const NAME = 'eventHandler';

class eventHandler {

  constructor() {
    const EventHandler = this;

    this._callbacks = {
      'docReady': {}, 'breakPointChange': {}, 'docShift': {},
      'startResize': {}, 'resize' : {}, 'endResize': {}, 'bodyResize': {},
      'docBlur': {}, 'docFocus': {},
      'scroll': {}, 'startScroll': {}, 'endScroll': {},
      'docLoaded' : {}, 'imgsLoaded' : {}
    }
    this._timestamps = {}
    this._lastRunTimeStamps = {}
    //events that are allowed to run multiple callbacks per event, within the same cycle (animationFrame)
    this._allowMultiple = [
      'breakPointChange'
    ];
    this._singleExecution = [
      'docReady','imgsLoaded','docLoaded'
    ]
    this._states = {}

    //ready events
    if (document.readyState !== "loading") {
      hnlLogger.info(NAME, 'Document is ready.');
      EventHandler._runListeners(['docReady', 'docShift']);
      EventHandler._states.docReady = true;
    } else {
      window.addEventListener("DOMContentLoaded", function (e) {
        hnlLogger.info(NAME, 'Document is ready.');
        EventHandler._runListeners(['docReady', 'docShift'], e);
        EventHandler._states.docReady = true;
      });
    }
    window.addEventListener("load", function (e) {
      hnlLogger.info(NAME, 'Page is fully loaded.');
      EventHandler._runListeners(['docLoaded'], e);
      EventHandler._states.docLoaded = true;
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
      EventHandler._timestamps['resize'] = performance.now();
      EventHandler._runListeners(['resize'], e);
    }, {execStart: true, execWhile: true, execDone: true}));
    window.addEventListener('resize', debounceThis((e)=> {
      hnlLogger.info(NAME, 'Resize started.');
      EventHandler._timestamps['resize'] = performance.now();
      EventHandler._runListeners(['startResize'], e);
    }, {execStart: true, execWhile: false, execDone: false}));
    window.addEventListener('resize', debounceThis((e)=> {
      e.TimeTaken = performance.now() - EventHandler._timestamps['resize'];
      hnlLogger.info(NAME, 'Resize ended. (took ' + e.TimeTaken + 'ms)');
      EventHandler._runListeners(['endResize', 'docShift'], e);
    }, {execStart: false, execWhile: false, execDone: true}));
    (new ResizeObserver(debounceThis((e) => {
      //hnlLogger.info(NAME, 'Body resized: ' + e[0].target.clientHeight);
      EventHandler._runListeners(['docShift', 'bodyResize'], e);
    }, {execStart: false, execWhile: false, execDone: true, threshold: 150} ))).observe(document.body);

    //debounced scroll events
    window.addEventListener('scroll', debounceThis((e)=> {
      EventHandler._timestamps['scroll'] = performance.now();
      //hnlLogger.info(NAME, 'Scroll started.');
      EventHandler._runListeners(['startScroll'], e);
    }, {execStart: true, execWhile: false, execDone: false}));
    window.addEventListener('scroll', debounceThis((e)=> {
      //hnlLogger.info(NAME, 'Scrolling.');
      EventHandler._runListeners(['scroll', 'docShift'], e);
    }, {execStart: false, execWhile: true, execDone: false, threshold: 200}));
    window.addEventListener('scroll', debounceThis((e)=> {
      e.TimeTaken = performance.now() - EventHandler._timestamps['scroll'];
      //hnlLogger.info(NAME, 'Scroll ended. (took ' + e.TimeTaken + 'ms)');
      EventHandler._runListeners(['endScroll'], e);
    }, {execStart: false, execWhile: false, execDone: true}));

    //document visibility events
    (function visibilityChanged() {
      const docHidden = (typeof document.hidden !== "undefined");
      const hidden = docHidden ? "hidden" : "msHidden";
      const visibilityChange = docHidden ? "visibilitychange" : "msvisibilitychange";
      let document_hidden = document[hidden];
      document.addEventListener(visibilityChange, function (e) {
        if (document_hidden !== document[hidden]) {
          if (document[hidden]) {
            EventHandler._timestamps['visibility'] = performance.now();
            hnlLogger.info(NAME, 'Document lost focus.');
            EventHandler._runListeners(['docBlur'], e);
          } else {
            e.TimeTaken = performance.now() - EventHandler._timestamps['visibility'];
            hnlLogger.info(NAME, 'Document regained focus. (took ' + e.TimeTaken + 'ms)');
            EventHandler._runListeners(['docFocus', 'docShift'], e);
          }
          document_hidden = document[hidden];
        }
      });
    }());

    //content events
    Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise(resolve => {
      img.onload = img.onerror = resolve;
    }))).then((e) => {
      hnlLogger.info(NAME, 'All images loaded.');
      EventHandler._runListeners(['imgsLoaded'], e);
      EventHandler._states.imgsLoaded = true;
    });
  }

  //private

  _hashCode(string) {
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
      let char = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  _runListeners(events, origEvent) {
    const callBacks = this._callbacks;
    const lastRunTimes = this._lastRunTimeStamps;
    const allowMultiple = this._allowMultiple;
    requestAnimationFrame((timeStamp)=>{

      events.forEach(function(event){

        for (let id in callBacks[event]) {
          if (callBacks[event].hasOwnProperty(id)) {
            let cb = callBacks[event][id];
            if (typeof (cb) === 'function') {
              // if the callback is about to be called within the same cycle (animationFrame),
              // skip subsequent calls, except if event is allowed multiple callbacks
              if (lastRunTimes[id] !== timeStamp || allowMultiple.includes(event)) {
                //hnlLogger.warn(NAME,`Running callback '${id}' (${cb.name || 'anonymous'}) @ ${timeStamp} for '${event}'`);
                lastRunTimes[id] = timeStamp;
                cb.call(this, origEvent);
              }
            }
          }
        }
      })

    })
  }

  //public

  addListener(event, callback) {
    if (!this._callbacks[event]) {
      hnlLogger.warn(NAME, 'No such event! (' + event + ')');
      return function(){};
    } else {
      if (this._singleExecution.includes(event) && this._states[event]) {
        //if this is an event that is executed only once during the page's lifetime, and it has already passed, call the callback immediately
        callback.call(this);
      } else {
        /* while the logic of argumentation is valid, this produces double calls with race conditions.
        if it is absolutely necessary (probably the actual docshift event will still occur as needed at pageload),
        this requires some rethinking.
        if (event === 'docShift' && document.readyState !== 'loading') {
          //same goes for layout shift events, though they still need to register
          callback.call(this);
        }*/
        const id = this._hashCode(callback.toString());
        if (typeof this._callbacks[event][id] === 'function') {
          hnlLogger.warn(NAME,`Callback '${id}' (${callback.name || 'anonymous'}) already assigned to event '${event}', skipping...`);
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
      const id = this._hashCode(callback.toString());
      if (this._callbacks[event][id]) {
        delete this._callbacks[event][id];
      }
    }
  }

  //shorthands
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

  imgsLoaded(callback) {
    return this.addListener('imgsLoaded', callback);
  }
}

//allow only one instance to prevent double binding
window.eventHandler = window.eventHandler ? window.eventHandler : new eventHandler();
export default window.eventHandler
//export {EventHandler as default};