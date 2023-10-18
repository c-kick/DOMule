/**
 * URL tools
 */


//url parameter bijwerken
export function changeUrlVar(key, value) {
  if ('URLSearchParams' in window) {
    let searchParams = new URLSearchParams(window.location.search);
    let setValue = (typeof value === 'undefined') ? true : value;
    if(searchParams.get(key) === null || (typeof value !== 'undefined')) {
      searchParams.set(key, setValue);
    } else if (typeof value === 'undefined') {
      searchParams.delete(key);
    }
    window.location.search = searchParams.toString();
  }
}