# DOMule
A dynamic, DOM-driven frontend JavaScript module loader

DOMule is a compact, DOM-driven module loader that dynamically ties [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) to the elements they enhance, reducing build complexity and optimizing page load times. By allowing each element to specify its own script-dependencies, it minimizes the need for manual script management and ensures only the necessary code is loaded, either immediately or as elements enter the viewport. This approach creates a highly responsive and maintainable development environment ideal for modern web applications.

The core system revolves around the `hnl.dynamicimports` and `hnl.eventhandler` modules, that each have their own dependencies. These dependencies are mainly stored in the `hnl.domscanner`, `hnl.helpers`, `hnl.logger` and `hnl.debounce` modules. Basic instructions for use are described [below](#instructions-for-use).

So, instead of writing JavaScript that waits for a page load, traverses the DOM for some element, and then performs a function, you can instead write everything you want to perform in a script file (a module), and tie it to the element (or elements) that it should work on using the `data-requires` attribute. (You can even tell it to delay execution until the element has become visible (lazy loading) by specifying the optional `data-requires-lazy="true"` attribute. So, no need to write your own intersection observer!)

## Example

After following the [instructions for use](#instructions-for-use), you can just specify in your HTML:

```HTML
<div data-requires="doSomeAjaxStuff.mjs">Loading...</div>
```
And then, inside your `doSomeAjaxStuff.mjs`, all you need to write is:

```JavaScript
export function init(elements){
    //Do your stuff here! 'elements' is a nodeList that contains all the elements that required this module
}
```

DOMule eliminates the need for manual class-based selectors or IDs by letting elements self-identify their dependencies, making the code cleaner and reducing the reliance on external targeting.

# What DOMule does
- On page load, it initializes itself as a deferred JavaScript module
- Firstly, global/window event handlers are set up, and then the system waits for the page (DOM) to load
- On load (DOM has loaded) it scans the DOM for `data-requires` attributes and compiles a list of modules to be loaded
- This list is de-duped, and then all modules are (down)loaded asynchronously, in the order they were found
- If a module exports an initializing function (`init`), this is called automatically after loading, using *all* nodes that required the module as an argument (`NodeList`)
- If a module is loaded with the additional `data-requires-lazy="true"` option, the module is not loaded immediately, but instead a watcher is set-up to check if the requiring node has become **visible inside the viewport**, after which the module is loaded. This allows you to postpone the loading of large scripts (or scripts that handle large amounts of data) until the user has actually scrolled far enough to reach them.

This shifts the responsibility for determining when scripts should load, which elements they should target (while still allowing flexibility), and when they should execute — directly to individual modules. This keeps your main code cleaner and frees you from managing script loading, initialization, setting up listeners for visibility changes, scroll events, window resizes, and breakpoint changes...

# Use cases
Some examples for using this system:
- Populating a `<select>` with XML data from an Ajax-request
- Revealing some `<div>` elements with fancy animations as soon as they becomde visible (like [Animate On Scroll](https://michalsnik.github.io/aos/))
- Loading a contact-form script, but only if the contact form is actually on the current page (and perhaps only if it's actually visible)
- Attaching to a `<button>`, to listen for a click and then doing something
- Attaching to a scrolling element, to listen for scrolling and acting upon it (example usage [here](https://code.hnldesign.nl/motionblur-scroller/))
- *Not* loading a bunch of heavy-duty, and heavy-weighing, scripts if the elements they need to work are not even on the current page (yet)
- *Only* loading a script if the user's (e.g. device's) screen is below, or above a certain threshold — useful for targeting Desktop, or Mobile, or Tablet users (see the `breakpointChange` event in the eventhandler).
- Making sure a really long page, with all kinds of different dynamic script-driven content, still loads fast (i.e. has a fast [TTI](https://web.dev/articles/tti) and a fast [FCP](https://web.dev/articles/fcp))

# Instructions for use
Store all modules inside your project (e.g. in /js/modules), write an entrypoint module (e.g. `entrypoint.mjs`), and include it in your page's `<head>` section (`<script type="module" src="entrypoint.mjs" defer></script>`). Inside that module:

```JavaScript
import eventHandler from 'js/modules/hnl.eventhandler.mjs';
import {dynImports} from 'js/modules/hnl.dynamicimports.mjs';

eventHandler.docReady(function(){

  //handle all dynamic module imports
  dynImports({
    'assets'  :  'https://code.hnldesign.nl/js/modules/' // Optional: specify asset base path for dynamic modules. In this example, '%assets%' will resolve to the url provided. This allows for shorter code, as well as 'mass' url replacement, for example in development/live situation
  }, function(e){
    //optional callback for when all modules are loaded/primed
  });

  //optionally do other stuff as soon as the document is ready (HTML content has been loaded, but not necessarily all images & resources)

});

eventHandler.docLoaded( function() {
  //do stuff as soon as the entire document is loaded (including images), note that modules can still be loading at this point
});
```

Then, follow the module system's `data-requires="modulename"` methodology inside the page to load modules when required:

```HTML
<div data-requires="js/modules/mymodule.mjs"></div>
```

Or, if path references were set (see above):

```HTML
<div data-requires="%assets%/mymodule.mjs"></div>
```

You can even load multiple modules per node by comma-separating them:

```HTML
<div data-requires="js/modules/mymodule.mjs,js/modules/myothermodule.mjs" data-require-lazy="true"></div>
```

(require-lazy means the module will only get loaded when the requiring element has become visible inside the users viewport. It will then try running the module's exported 'init' function, if it has one, with the element in question as an object argument).

## What are the other files?
Alongside the core modules mentioned earlier, the repository also contains a collection of various pre-built JavaScript modules I wrote and regularly use in my various projects. See the JSDoc comments inside each module to see what they do. If you want to write your own, you can use the `_template` module as a starting point.

# Using your own, or third party, modules

While `_template.mjs` provides a boilerplate, and instructions for writing your own module, this doesn't mean you have to use the module-logic described there — you can use whatever ES6 modules you want (you can also instruct DOM nodes to use native third-party modules, as long as they are valid ES6 JavaScript modules). DOMule is basically nothing more than an advanced on-demand module loader, with a few extras installed.

For example, you can also dynamically load [Bootstrap](https://getbootstrap.com/)'s JavaScript modules if you'd like:

```HTML
<p class="d-inline-flex gap-1" data-requires="bootstrap/js/src/collapse.js">
    <a class="btn btn-primary" data-bs-toggle="collapse" href="#collapseExample" role="button" aria-expanded="false" aria-controls="collapseExample">
        Link with href
    </a>
</p>
<div class="collapse" id="collapseExample">
    <div class="card card-body">
        Some placeholder content for the collapse component. This panel is hidden by default but revealed when the user activates the relevant trigger.
    </div>
</div>
```
(You can even use a full url, like `data-requires="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/js/src/collapse.js"`)

# Notes

Though this is my personal repository for maintaining the moduling system, feel free to use it yourself. But please note: modules may change/disappear without prior notice.
