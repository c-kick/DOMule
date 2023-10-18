/**
 * URL tools
 */
import {hnlLogger} from "./hnl.logger.mjs";
const NAME = 'urlTools';

//url parameter bijwerken
export function changeUrlVar(key, value, navigate = true) {
  if ('URLSearchParams' in window) {
    let searchParams = new URLSearchParams(window.location.search);
    let setValue = (typeof value === 'undefined') ? 'true' : ((typeof value === 'boolean' && !value) ? 'false' : value);
    if (typeof value === 'undefined' && searchParams.get(key)) {
      //delete if key passed with no value, and key already existed in search parameters
      searchParams.delete(key);
    } else {
      searchParams.set(key, setValue);
    }
    if (navigate) {
      window.location.search = searchParams.toString();
    } else {
      history.pushState("", document.title, window.location.pathname + '?' + searchParams.toString())
    }
  } else {
    hnlLogger.warn(NAME, 'Window has no search param support.');
  }
}


export function init(elements){
  elements.forEach((element) => {
    //assign functions
    element.changeUrlVar = changeUrlVar;
  })
}