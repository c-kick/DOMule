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
import {isVisible} from "./hnl.helpers.mjs";
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
 * @param {object} paths - Paths for resolving %location% (optional)
 * @param {function} [callback] - A callback function to be executed after all dynamic imports have finished loading.
 */
export function dynImports(paths = {}, callback) {
  // If the first argument is a function, treat it as a callback
  [callback, paths] = typeof paths === 'function' ? [paths, {}] : [callback, paths];
  const dynImportPaths = { ...defaultPaths, ...paths };
  domScanner('requires', function (modules, deferredModules, totals) {
    const importPromises = [];

    // Process modules found in DOM
    for (const [key, elements] of Object.entries(modules)) {
      const path = rewritePath(key, dynImportPaths);
      hnlLogger.info(NAME, `Importing ${path.split('?')[0]}...`);

      importPromises.push(
          import(path)
              .then((module) => {
                const name = moduleName(module, key);
                hnlLogger.info(name, ' Imported.');
                if (typeof module.init === 'function') {
                  hnlLogger.info(name, ` Initializing for ${elements.length} element(s).`);
                  module.init.call(module, elements);
                }
              })
              .catch((error) => {
                hnlLogger.error(NAME, error);
              })
      );
    }

    // Wait for all imports to finish
    Promise.allSettled(importPromises).then(() => {
      hnlLogger.info(NAME, 'All dynamic imports finished loading.');
      hnlLogger.info(NAME, { modules: { ...modules }, deferredModules: { ...deferredModules } });
      if (typeof callback === 'function') {
        callback.call(this);
      }
    });

    // Process deferred modules (lazy-loaded)
    for (const [key, elements] of Object.entries(deferredModules)) {
      const watchModules = () => {
        for (const element of elements) {
          isVisible(element, (visible) => {
            if (!visible || !deferredModules[key]) return;

            hnlLogger.info(NAME, 'Element visible, loading lazy module and clearing watcher.');
            const path = rewritePath(key, dynImportPaths);

            import(path)
                .then((module) => {
                  const name = moduleName(module, key);
                  hnlLogger.info(name, ' Imported (lazy).');
                  if (typeof module.init === 'function') {
                    hnlLogger.info(name, ` Initializing (lazy) for ${elements.length} element(s).`);
                    module.init.call(module, elements);
                  }
                  delete deferredModules[key];
                })
                .catch((error) => {
                  hnlLogger.error(NAME, error);
                });

            eventHandler.removeListener('docShift', watchModules);
          });
        }
      };

      // Bind to document shifts (scrolling, resizing, etc.)
      eventHandler.addListener('docShift', watchModules);
    }
  });
}
