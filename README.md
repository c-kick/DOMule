# DOMule
A dynamic, DOM-driven frontend JavaScript module loader

## What is this?

A lightweight module loader that lets DOM elements declare their JavaScript dependencies. Write `<div data-requires="module.mjs">` and DOMule imports that module, calls its `init()` function with all requiring elements, and optionally defers loading until the element is visible. Zero build step, pure ES6 modules.

## Why I built this

Most JavaScript frameworks solve the problem backwards: scripts search the DOM for elements to enhance. Scripts that are there. Always. On each load, regardless of context. 

DOMule inverts this—**elements declare what they need**.

This eliminates three common problems:

1. **Wasted bytes**: Scripts load even when their target elements aren't on the page
2. **Manual orchestration**: You write selectors, bind events, manage initialization order
3. **Build complexity**: Bundlers, tree-shaking, code-splitting configs

DOMule solves this with pure ES6 modules and a simple contract: an element says `data-requires="module.mjs"`, and that module's `init()` function receives all elements that required it. Add `data-require-lazy="true"` and the module only loads when the element enters the viewport.

No build step. No framework lock-in. Just load what you need, when you need it.

## Who would use this?

- Content-heavy sites where most pages use 20% of available JS features
- Server-rendered pages with progressive enhancement
- Teams without (or avoiding) build pipelines
- Projects where "just attach behavior to elements" covers 80% of JS needs
- Sites with optional heavy features (galleries, maps, forms) that shouldn't penalize every page

## Who wouldn't?
- Large SPAs with complex state management (use React/Vue/Svelte)
- Applications requiring SSR hydration
- Projects already invested in a bundler workflow
- Teams needing component-level reactivity

If your mental model is "this element needs this script" rather than "this app needs this state tree," DOMule fits.

## Why not use...

### Stimulus.js
**What it does:** Controllers attach to `data-controller` attributes with lifecycle callbacks, targets, and actions.

**Key difference:** Stimulus is a full framework for organizing behavior. DOMule is just a loader—it imports modules and calls `init()`, then gets out of the way. No lifecycle, no targets, no framework opinions. If you need structure, use Stimulus. If you just need "load this when that appears," DOMule is lighter.

### Alpine.js
**What it does:** Declarative reactivity via data attributes (`x-data`, `x-show`, `x-model`).

**Key difference:** Alpine handles UI state and interactivity. DOMule handles *module loading*. Alpine is always present on the page; DOMule modules only load when needed. You'd use Alpine for reactive components, DOMule for loading the scripts that power them (or not loading them if they're not on the page).

### RequireJS/AMD
**What it does:** Asynchronous module loading with dependency management via `define()` and `require()`.

**Key difference:** RequireJS uses programmatic, script-driven loading (`require(['module'], callback)`). DOMule uses *DOM-driven* loading (`data-requires="module"`). RequireJS requires wrapping everything in AMD syntax. DOMule uses native ES6 modules. RequireJS solves "load dependencies in order." DOMule solves "only load what's on the page."

### Webpack Code Splitting
**What it does:** Build-time analysis to split bundles and lazy-load chunks via `import()`.

**Key difference:** Webpack decides splits during build based on static analysis. DOMule decides at *runtime* based on viewport visibility. Webpack requires a *build* step and toolchain. DOMule runs in the browser with zero build. Webpack optimizes bundles. DOMule optimizes *page load* by not loading scripts for absent elements.

---

**The pattern no one else solves:** "Load this script only if this element exists *and* is visible, then pass all matching elements to one initialization function." That specific intersection is DOMule's territory.

## How does it work?

DOMule is a compact, DOM-driven module loader that dynamically ties [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) to the elements they enhance, reducing build complexity and optimizing page load times. By allowing each element to specify its own script-dependencies, it minimizes the need for manual script management and ensures only the necessary code is loaded, either immediately or as elements enter the viewport. This approach creates a highly responsive and maintainable development environment ideal for modern web applications.

The core system revolves around the `hnl.dynamicimports` and `hnl.eventhandler` modules, that each have their own dependencies. These dependencies are mainly stored in the `hnl.domscanner`, `hnl.helpers`, `hnl.logger` and `hnl.debounce` modules. Basic instructions for use are described [below](#instructions-for-use).

So, instead of writing JavaScript that waits for a page load, traverses the DOM for some element, and then performs a function, you can instead write everything you want to perform in a script file (a module), and tie it to the element (or elements) that it should work on using the `data-requires` attribute. (You can even tell it to delay execution until the element has become visible (lazy loading) by specifying the optional `data-require-lazy="true"` attribute. So, no need to write your own intersection observer!)

## Example

After following the [instructions for use](#instructions-for-use), you can just specify in your HTML:

```HTML
<div data-requires="doSomeAjaxStuff.mjs">Loading...</div>
```
And then, inside your `doSomeAjaxStuff.mjs`, all you need to write is:

```JavaScript
export const NAME = 'doSomeAjaxStuff'; // Optional but recommended for better logging

export function init(elements){
    // Do your stuff here! 'elements' is a NodeList that contains all the elements that required this module

    // Optionally return a status message or false to indicate problems
    return 'Ajax stuff initialized successfully';
}
```

DOMule eliminates the need for manual class-based selectors or IDs by letting elements self-identify their dependencies, making the code cleaner and reducing the reliance on external targeting.

# What DOMule does
- On page load, it initializes itself as a JavaScript module
- Firstly, global/window event handlers are set up, and then the system waits for the page (DOM) to load
- On load (DOM has loaded) it scans the DOM for `data-requires` attributes and compiles a list of modules to be loaded
- This list is de-duped, and then all modules are **loaded asynchronously in parallel** (not sequentially—order depends on network conditions)
- If a module exports an initializing function (`init`), this is called automatically after loading, using *all* nodes that required the module as an argument (`NodeList`)
- Module initialization is wrapped in error handling—failures are logged but don't crash the page
- If a module is loaded with the additional `data-require-lazy="true"` option, the module is not loaded immediately, but instead a watcher is set-up to check if the requiring node has become **visible inside the viewport**, after which the module is loaded and the watcher is cleaned up
- A comprehensive logging system tracks module loading, initialization, and errors (enabled via `?debug=true` query parameter)

This shifts the responsibility for determining when scripts should load, which elements they should target (while still allowing flexibility), and when they should execute — directly to individual modules. This keeps your main code cleaner and frees you from managing script loading, initialization, setting up listeners for visibility changes, scroll events, window resizes, and breakpoint changes...

# Use cases
Some examples for using this system:
- Populating a `<select>` with XML data from an Ajax-request
- Revealing some `<div>` elements with fancy animations as soon as they become visible (like [Animate On Scroll](https://michalsnik.github.io/aos/))
- Loading a contact-form script, but only if the contact form is actually on the current page (and perhaps only if it's actually visible)
- Attaching to a `<button>`, to listen for a click and then doing something
- Attaching to a scrolling element, to listen for scrolling and acting upon it (example usage [here](https://code.hnldesign.nl/motionblur-scroller/))
- *Not* loading a bunch of heavy-duty, and heavy-weighing, scripts if the elements they need to work on are not even on the current page (yet)
- *Only* loading a script if the user's (e.g. device's) screen is below, or above a certain threshold — useful for targeting Desktop, or Mobile, or Tablet users (see the `breakpointChange` event in the eventhandler)
- Making sure a really long page, with all kinds of different dynamic script-driven content, still loads fast (i.e. has a fast [TTI](https://web.dev/articles/tti) and a fast [FCP](https://web.dev/articles/fcp))

# Instructions for use
Store all modules inside your project (e.g. in `/js/modules`), write an entrypoint module (e.g. `entrypoint.mjs`), and include it in your page's `<head>` section (`<script type="module" src="entrypoint.mjs"></script>`). Inside that module:

```JavaScript
import eventHandler from 'js/modules/hnl.eventhandler.mjs';
import {dynImports} from 'js/modules/hnl.dynamicimports.mjs';

eventHandler.docReady(function(){

  // Handle all dynamic module imports
  dynImports({
    'assets': 'https://code.hnldesign.nl/js/modules/' // Optional: specify asset base path for dynamic modules
  }, function(e){
    // Optional callback for when all modules are loaded/primed
    console.log('All modules initialized');
  });

  // Optionally do other stuff as soon as the document is ready (HTML content has been loaded, but not necessarily all images & resources)

});

eventHandler.docLoaded(function() {
  // Do stuff as soon as the entire document is loaded (including images)
  // Note that modules can still be loading at this point
});
```

**Important:** The `eventHandler` is a singleton that auto-initializes on first import. It automatically imports and initializes the breakpoint handler (`hnl.breakpoints.mjs`), so you don't need to import that separately.

Then, follow the module system's `data-requires="modulename"` methodology inside the page to load modules when required:

```HTML
<div data-requires="js/modules/mymodule.mjs"></div>
```

Or, if path references were set (see above):

```HTML
<div data-requires="%assets%mymodule.mjs"></div>
```

You can even load multiple modules per node by comma-separating them:

```HTML
<div data-requires="js/modules/mymodule.mjs,js/modules/myothermodule.mjs" data-require-lazy="true"></div>
```

(`data-require-lazy="true"` means the module will only get loaded when the requiring element has become visible inside the user's viewport. It will then try running the module's exported `init` function, if it has one, with the element in question as an object argument. After loading, the visibility watcher is automatically cleaned up to prevent memory leaks.)

## Path Resolution and Rewriting

DOMule automatically handles path resolution with several built-in features:

### 1. Custom Path References
Define reusable path aliases in your config:
```javascript
dynImports({
  'assets': 'https://cdn.example.com/js/',
  'vendor': 'https://unpkg.com/'
});
```
Then use them with `%name%` syntax:
```html
<div data-requires="%assets%mymodule.mjs"></div>
<div data-requires="%vendor%lodash@4.17.21/lodash.min.js"></div>
```

### 2. Automatic Relative Path Adjustment
**Important:** All relative paths starting with `./` are automatically rewritten to `./../` to navigate one level up from the module loader's location. Plan your directory structure accordingly:
```
project/
├── js/
│   └── modules/
│       └── hnl.dynamicimports.mjs  ← loader is here
└── modules/                         ← your modules should be here
    └── mymodule.mjs
```
```html
<!-- This becomes './../modules/mymodule.mjs' automatically -->
<div data-requires="./modules/mymodule.mjs"></div>
```

### 3. CSP/Nonce Support
If a global `SITE_NONCE` variable exists, it's automatically appended to module URLs for Content Security Policy compliance:
```javascript
// In your page <head>:
<script>const SITE_NONCE = 'your-nonce-here';</script>

// DOMule automatically adds: ?nonce=your-nonce-here
```

### 4. Full URLs
You can use complete URLs to load modules from CDNs or external sources:
```html
<div data-requires="https://cdn.example.com/module.mjs"></div>
```

## Debug Mode

Enable comprehensive logging by adding `?debug=true` to your URL:

```
https://yoursite.com/page.html?debug=true
```

**Debug mode provides:**
- Detailed module loading and initialization logs
- Color-coded console output for easy identification
- Error stack traces for module initialization failures
- Cache-busting via random UUID appended to module URLs (forces fresh download on every page load)
- Performance timing information

**Example debug output:**
```
[dynImports] Importing https://code.hnldesign.nl/js/modules/mymodule.mjs?debug=true&random=a3f2e1...
[mymodule] Imported.
[mymodule] Initializing for 3 element(s).
[mymodule] Initialized, module said: All systems operational
```

**Tip:** Debug mode is detected via `window.location.search.includes('debug=true')` and controls both the logger output and cache behavior throughout the system.

## Writing Modules

### Basic Module Template

Use `_template.mjs` as a boilerplate, or follow this structure:

```javascript
/**
 * Module description
 */
import {isVisible} from "./hnl.helpers.mjs";
import eventHandler from "./hnl.eventhandler.mjs";
import {hnlLogger} from "./hnl.logger.mjs";

/**
 * NAME constant - used by the logger for identification
 * This is optional but highly recommended for better debugging
 * If not provided, the filename will be used instead
 */
export const NAME = 'myModule';

/**
 * init - Called automatically when the module is loaded
 * @param {NodeList} elements - All DOM elements with data-requires="thismodule"
 * @returns {string|boolean|undefined} Optional return value:
 *   - string: Success message (logged as info)
 *   - false: Indicates initialization failure (logged as warning)
 *   - undefined: Silent success (no additional logging)
 */
export function init(elements){
  // Your initialization code here
  
  elements.forEach(function(element){
    // Do something with each element
  });
  
  // Optional: return status
  return `Initialized ${elements.length} element(s)`;
  
  // Or indicate failure:
  // return false;
}
```

### Module Initialization Behavior

**Key points about `init()`:**
1. **Automatic execution:** If your module exports an `init` function, it's called automatically after the module loads
2. **Error handling:** Initialization is wrapped in try/catch—errors are logged but won't crash other modules
3. **Return values:**
    - **String:** Logged as info message (useful for status reporting)
    - **`false`:** Logged as warning (indicates initialization problems)
    - **`undefined`/nothing:** Silent success
4. **Element batching:** All elements requiring the same module are passed together as a NodeList—process them efficiently
5. **Execution context:** `this` inside `init()` refers to the module object itself

**Example with error handling:**
```javascript
export function init(elements){
  if (!elements.length) {
    return false; // Logged as warning
  }
  
  try {
    // Your code here
    return 'Module ready';
  } catch (error) {
    // This is caught by DOMule's wrapper
    throw new Error(`Failed to initialize: ${error.message}`);
  }
}
```

### Lazy Loading Behavior

When using `data-require-lazy="true"`:

1. Module is **not** loaded immediately
2. A visibility watcher is attached to the requiring element
3. Watcher checks on every `docShift` event (scroll, resize, visibility changes)
4. When element becomes visible:
    - Module is loaded
    - `init()` is called with all lazy-loaded elements
    - Watcher is **removed** and deferred module reference is **deleted**
5. This prevents memory leaks from persistent observers

**Example:**
```html
<!-- This video player script only loads when the video comes into view -->
<video data-requires="js/modules/videoplayer.mjs" data-require-lazy="true">
  <source src="video.mp4" type="video/mp4">
</video>
```

## What are the other files?
Alongside the core modules mentioned earlier, the repository also contains a collection of various pre-built JavaScript modules I wrote and regularly use in my various projects. See the JSDoc comments inside each module to see what they do. If you want to write your own, you can use the `_template.mjs` module as a starting point.

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

**Note:** Third-party modules without an exported `init()` function will simply load and execute their top-level code. If they export other functions or classes, you can access them via subsequent imports in your own modules.

# Troubleshooting

## Common Issues

### Module doesn't load
**Check:**
- Browser console for errors (enable debug mode with `?debug=true`)
- Path is correct (remember `./` becomes `./../` automatically)
- Module is a valid ES6 module with `export` statements
- No syntax errors in the module file

### `init()` not called
**Verify:**
- Your module exports a function named `init` (case-sensitive)
- Function signature matches: `export function init(elements){}`
- Check console for initialization errors (may have thrown before completion)

### Lazy loading not working
**Common causes:**
- Element is already visible on page load (watcher never triggers)
- Element has `display: none` or is outside viewport entirely
- Typo in attribute: use `data-require-lazy="true"` (not `data-require-lazy`)

### Multiple modules loading the same dependency
**Solution:** Import shared dependencies normally at the top of each module—the browser's native module system deduplicates imports automatically.

### Race conditions between modules
**Remember:** Modules load **in parallel**, not sequentially. If module B depends on module A completing first:
- Have module B import module A directly
- Use the dynImports callback for post-load coordination
- Leverage `eventHandler` events for lifecycle management

### Performance issues
**Optimize:**
- Use lazy loading for below-the-fold content
- Minimize the number of small modules (bundle related functionality)
- Use the browser cache (avoid `?debug=true` in production)
- Preload critical modules with `<link rel="modulepreload">`

# Notes

Though this is my personal repository for maintaining the moduling system, feel free to use it yourself. But please note: modules may change/disappear without prior notice.

---

**Changes from v1.2 to v1.3:**
- Added comprehensive error handling for module initialization
- Improved logging with module return value support
- Enhanced lazy loading with automatic watcher cleanup
- Added CSP/nonce support for secure environments
- Parallel loading explicitly documented
