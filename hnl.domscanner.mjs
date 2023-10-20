import {hnlLogger} from "./hnl.logger.mjs";

const NAME = 'domScanner';
const _modules = {};
const _deferred = {};

export function domScanner($name, $callBack, $stripExtension) {
  hnlLogger.info(NAME, 'Scan for \'data-' + $name + '\' modules in DOM');
  let modsReq = document.querySelectorAll('[data-' + $name + ']');
  let stripExt = $stripExtension ? $stripExtension : false; //strip extension?
  modsReq.forEach(function (element) {
    element.dataset[$name].split(',').forEach(function (mod) {
      const module = stripExt ? mod.replace(/\.m*js$/, '') : mod;
      if (module.toString().trim()) {
        // if data-require-lazy is set (to true),
        // defer loading of module until (one of the) requiring element(s) is visible
        if (element.dataset['requireLazy']) {
          // element is likely invisible, defer module loading and place a watcher for layout shifts
          (_deferred[module] = _deferred[module] ? _deferred[module] : []).push(element);
        } else {
          (_modules[module] = _modules[module] ? _modules[module] : []).push(element);
        }
      }
    })
  });
  if (typeof $callBack === 'function' || !modsReq.length) {
    let totals = Object.keys(_modules).length;
    let deferredTotals = Object.keys(_deferred).length;
    hnlLogger.info(NAME, 'Scan done, ' + totals + ' module(s) found.' + (deferredTotals ? ' (And ' + deferredTotals + ' lazy module(s) found)' : ''));
    //hnlLogger.info(NAME, _modules);
    if (typeof $callBack === 'function') {
      $callBack.call(this, _modules, _deferred, totals);
    }
  }
}