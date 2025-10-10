/**
 * Module template
 *
 * Usage:
 *       fpsCounter().then((fps)=> {
 *         console.log(fps);
 *       });
 */

function standardDeviation(arr) {
  const n = arr.length;
  const mean = arr.reduce((acc, val) => acc + val, 0) / n;
  const variance = arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

const fpsCounter = (function(stabilizationTime = 1500, stabilizationThreshold = 5){
  let startTime = Date.now();
  let frame = 0;
  let fps = 0;
  let fpsStable = false;
  let fpsValues = [];

  function tick(interval = 1000) {
    const time = Date.now();
    frame++;

    if (time - startTime > interval) {
      fps = (frame / ((time - startTime) / 1000)).toFixed(1);
      startTime = time;
      frame = 0;

      fpsValues.push(fps);
      if (fpsValues.length >= stabilizationTime / 1000) {
        const fpsStdev = standardDeviation(fpsValues);
        if (fpsStdev < stabilizationThreshold) {
          fpsStable = true;
        } else {
          fpsValues.shift();
        }
      }
    }

    window.requestAnimationFrame(() => tick(interval));
  }

  tick(stabilizationTime/4);

  return async function getFps() {
    if (!fpsStable) {
      await new Promise(resolve => setTimeout(resolve, stabilizationTime));
    }
    return fps;
  }
}());

// Export the Promise object from the module
export default fpsCounter;
