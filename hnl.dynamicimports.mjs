/**
 * Dynamic module importer v1.3 (10-2023)
 * (C) hnldesign 2022-2023
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
import eventHandler from "./hnl.eventhandler.mjs";

export const NAME = 'dynImports';

const deferredModules = {};
const defaultPaths = {
  //'name'  :  'https://url.here'
}

/**
 * Rewrites the path of the module, includes a site nonce if it exists.
 * Replaces %path% definitions if found in dynImportPaths config const.
 * @param {string} uri - The URI of the module to load.
 * @param dynamicPaths
 * @returns {string} - The rewritten URI with the site nonce appended, if it exists.
 */
function rewritePath(uri, dynamicPaths) {
  const params = new URLSearchParams(uri.split('?')[1] || '');
  //check if path was preceded by a %path%, indicating a custom path to a uniform resource locator prefix
  let customPath = (new RegExp(/^%(.*?)%/gi).exec(uri));
  if (customPath && dynamicPaths[customPath[1]]) {
    uri = uri.replace(`${customPath[0]}/`, dynamicPaths[customPath[1]]);
  } else {
    if (typeof SITE_NONCE !== 'undefined') { params.append('nonce', SITE_NONCE) }
    uri = uri.replace('./', './../');
  }
  if (window.location.search.includes('debug=true')) {
    params.append('debug', 'true');
    params.append('random', window.crypto.randomUUID());
  }
  return uri.split('?')[0] + '?' + params.toString();
}

/**
 * Gets the module name from either the exported NAME const, or the module's path (filename).
 * @param module  the imported module
 * @param {string} path  the path of the module
 * @returns {string} the name of the module
 */
function moduleName(module, path) {
  return (typeof module.NAME !== 'undefined') ? module.NAME : path.split('/').splice(-1)[0].split('?').slice(0,-1)[0];
}

/**
 * Scans DOM for elements that have a 'data-requires' attribute set, with the required module as a variable.
 * Queues up all modules found and then loads them sequentially.
 * Has support for lazy loading via 'data-requires-lazy="true"' attributes,
 * meaning the module will only get loaded when the requiring element has become visible in the browser's viewport.
 * On loading, it will try invoking the module's exported 'init' function, if it has one.
 *
 * Example:
 * <div data-requires="./modules/hnl.colortool.mjs" data-require-lazy="true"></div>
 *
 * @param {object} paths - Paths for resolving %location%
 * @param {function} [callback] - A callback function to be executed after all dynamic imports have finished loading.
 */
export function dynImports(paths = {}, callback) {
  const dynImportPaths = {...defaultPaths, ...paths};
  domScanner('requires', function (modules, deferredModules, totals) {
    let c = totals;

    //process modules found in DOM
    objForEach(modules, function (key, elements, index) {
      const path = rewritePath(key, dynImportPaths);
      hnlLogger.info(NAME, 'Importing ' + path.split('?')[0] + '...');

      import(path).then(function (module) {
        const name = moduleName(module, key);
        hnlLogger.info(name, ' Imported.');
        if (typeof module.init === 'function') {
          //module exports a 'init' function, call it
          try {
            hnlLogger.info(name, ` Initializing for ${elements.length} element(s).`);
            module.init.call(module, elements);
          } catch (err) {
            hnlLogger.error(name, err);
          }
        }
        c--;
      }).catch(function (error) {
        hnlLogger.error(NAME, error);
        hnlLogger.error(NAME, error.message);
      }).finally(function (e) {
        if (!c) {
          hnlLogger.info(NAME, 'All dynamic imports finished loading.');
          //spread the objects, as they get mutated later on, so logging will then be inaccurate
          hnlLogger.info(NAME, {modules : {...modules}, deferredModules: {...deferredModules}});
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
          isVisible(element, function(visible){
            if (visible) {

              if (deferredModules[key]) {
                hnlLogger.info(NAME, 'Element (at least one of those requiring) is visible, loading lazy module and clearing watcher.');
                const path = rewritePath(key, dynImportPaths);

                import(path).then(function (module) {
                  const name = moduleName(module, key);
                  hnlLogger.info(name, ' Imported (lazy).');
                  if (typeof module.init === 'function') {
                    //module exports a 'init' function, call it
                    try {
                      hnlLogger.info(name, ` Initializing (lazy) for ${elements.length} element(s).`);
                      module.init.call(module, elements);
                    } catch (err) {
                      hnlLogger.error(name, err);
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
            }
          })
        });
      }
      //bind to docShift event, which triggers whenever the document shifts inside the user's viewport (scrolling, resizing, etc).
      eventHandler.addListener('docShift', watchModules);
    });

  });
}