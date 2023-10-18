/**
 * Dynamic module importer v1.1 (1-2023)
 * (C) hnldesign 2022
 *
 * -  Scans DOM for elements that have a 'data-requires' attribute set, with the required module as a variable
 * -  Queues up all modules found and then loads them sequentially
 * -  Has support for lazy loading via 'data-requires-lazy="true"' attributes,
 *    meaning the module will only get loaded when the requiring element has become visible.
 *    It will then try running the module's exported 'init' function if it has one.
 *
 * Example:
 * <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>
 */
import {domScanner} from "./hnl.domscanner.mjs";
import {isVisible, objForEach} from "./hnl.helpers.mjs";
import {hnlLogger} from "./hnl.logger.mjs";
import eventHandler from './hnl.eventhandler.mjs';

const NAME = 'dynImports';
const deferredModules = {};

/**
 * Rewrites the path of the module to include a site nonce if it exists.
 * @param {string} uri - The URI of the module to load.
 * @returns {string} - The rewritten URI with the site nonce appended, if it exists.
 */
function rewritePath(uri) {
  return uri.replace('./', './../') + (typeof SITE_NONCE !== 'undefined' ? '?' + SITE_NONCE : '');
}


/**
 * Loads the module and executes its 'init' function, if it has one.
 * @param {string} key - The URI of the module to load.
 * @param {Array<Element>} elements - The array of elements that require the module to be loaded.
 * @param {boolean} [isLazy=false] - A flag indicating whether the module should be loaded lazily.
 */
function loadModule(key, elements, isLazy = false) {
  hnlLogger.info(NAME, `Importing ${key}...`);
  import(rewritePath(key)).then((module) => {

  })
}

/**
 * Scans DOM for elements that have a 'data-requires' attribute set, with the required module as a variable.
 * Queues up all modules found and then loads them sequentially.
 * Has support for lazy loading via 'data-requires-lazy="true"' attributes,
 * meaning the module will only get loaded when the requiring element has become visible.
 * It will then try running the module's exported 'init' function if it has one.
 *
 * Example:
 * <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>
 *
 * @param {function} [callback] - A callback function to be executed after all dynamic imports have finished loading.
 */
export function dynImports(callback) {
  domScanner('requires', function (modules, deferredModules, totals) {
    let c = totals;

    //process modules found in DOM
    objForEach(modules, function (key, elements, index) {
      hnlLogger.info(NAME, 'Importing ' + key + '...');

      import(rewritePath(key)).then(function (module) {
        hnlLogger.info(NAME, key + ' Imported.');
        if (typeof module.init === 'function') {
          //module exports a 'init' function, call it
          try {
            hnlLogger.info(NAME, key + ' has init, calling...');
            module.init.call(module, elements);
          } catch (err) {
            hnlLogger.error(NAME, err);
          }
        }
        c--;
      }).catch(function (error) {
        hnlLogger.error(NAME, error);
      }).finally(function (e) {
        if (!c) {
          hnlLogger.info(NAME, 'All dynamic imports finished loading.');
          if(typeof callback === 'function') {
            callback.call(this, e);
          }
        }
      });
    });

    //process modules found in DOM that want to be loaded when their requiring element becomes visible
    objForEach(deferredModules, function (key, elements, index) {
      function watchModules() {
        elements.forEach(function(element){
          isVisible(element, function(){
            if (deferredModules[key]) {
              hnlLogger.info(NAME, 'Element (at least one of those requiring) is visible, loading lazy module and clearing watcher.');

              import(rewritePath(key)).then(function (module) {
                hnlLogger.info(NAME, key + ' Imported (lazy).');
                if (typeof module.init === 'function') {
                  //module exports a 'init' function, call it
                  try {
                    hnlLogger.info(NAME, key + ' has init, calling...');
                    module.init.call(module, elements);
                  } catch (err) {
                    hnlLogger.error(NAME, err);
                  }
                }
                //remove element from deferred module queue to prevent reloading of the same module
                delete deferredModules[key];

              }).catch(function (error) {
                hnlLogger.error(NAME, error);
              });
            }
            //stop listening, unbind self
            eventHandler.removeListener('docShift', watchModules);
          })
        });
      }
      //bind to docShift event, which triggers whenever the document shifts inside the user's viewport (scrolling, resizing, etc).
      eventHandler.addListener('docShift', watchModules);
    });

  });
}