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

## Architecture

DOMule uses a three-tier module architecture:

### 1. Core Tier (`core.*`)
System infrastructure required for DOMule to function:

- **`core.scanner.mjs`** – Discovers elements with `data-requires` attributes
- **`core.loader.mjs`** – Orchestrates module imports and initialization
- **`core.events.mjs`** – Manages lifecycle events (docReady, resize, scroll, etc.)
- **`core.log.mjs`** – Provides colored console logging (enabled via `?debug=true`)

### 2. Utility Tier (`util.*`)
Reusable helpers used by core and available to modules:

- **`util.observe.mjs`** – Visibility/resize detection (isVisible, IntersectionObserver wrappers)
- **`util.debounce.mjs`** – Debounce/throttle functions for events
- **`util.color.mjs`** – Color generation and manipulation
- **`util.dom.mjs`** – DOM manipulation utilities
- **`util.format.mjs`** – String/phone/URL formatting
- **`util.math.mjs`** – Math utilities, bezier curves
- **`util.perf.mjs`** – FPS counter, performance tracking
- **`util.iteration.mjs`** – Array/object iteration helpers

### 3. Module Tier
Your own modules! There are some examples in the repository (e.g. `hnl.breakpoints.mjs`, 
`hnl.baseline-grid.mjs`), and you can use `_template.mjs` to get started with writing your own.

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

## Instructions for use

### 1. Create an entrypoint module

```javascript
// entrypoint.mjs
import events from './core.events.mjs';
import {dynImports} from './core.loader.mjs';

events.docReady(() => {
  // Handle all dynamic module imports
  dynImports({
    'assets': 'https://cdn.example.com/js/' // Optional: path aliases
  }, () => {
    console.log('All modules initialized');
  });
});
```

### 2. Include it in your page

```html
<head>
  <script type="module" src="entrypoint.mjs"></script>
</head>
```

### 3. Add modules to elements

```html
<!-- Basic usage -->
<div data-requires="./modules/mymodule.mjs"></div>

<!-- Using path aliases (if configured) -->
<div data-requires="%assets%mymodule.mjs"></div>

<!-- Multiple modules -->
<div data-requires="./modules/slider.mjs,./modules/analytics.mjs"></div>

<!-- Lazy loading (only loads when visible) -->
<div data-requires="./modules/gallery.mjs" data-require-lazy="true"></div>
```

## Example Module

```javascript
/**
 * Example module that fades in elements when they become visible
 */
import {isVisible} from "./util.observe.mjs";
import events from "./core.events.mjs";
import {logger} from "./core.log.mjs";

/**
 * Module name (used for logging)
 */
export const NAME = 'fadeInModule';

/**
 * Called automatically when module is loaded
 * @param {NodeList} elements - All elements with data-requires="thismodule"
 * @returns {string|boolean|undefined} Optional status message
 */
export function init(elements) {
  // Check visibility on scroll/resize
  events.addListener('docShift', () => {
    elements.forEach(element => {
      isVisible(element, (visible) => {
        if (visible) {
          element.classList.add('fade-in');
          logger.log(NAME, 'Element became visible');
        }
      });
    });
  });
  
  return `Initialized ${elements.length} element(s)`;
}
```

## Path Resolution

DOMule automatically handles path resolution:

### 1. Custom Path References
Define reusable path aliases:
```javascript
dynImports({
  'assets': 'https://cdn.example.com/js/',
  'vendor': 'https://unpkg.com/'
});
```
Use with `%name%` syntax:
```html
<div data-requires="%assets%mymodule.mjs"></div>
<div data-requires="%vendor%lodash@4.17.21/lodash.min.js"></div>
```

### 2. Automatic Relative Path Adjustment
**Important:** Relative paths starting with `./` are automatically rewritten to `./../` to navigate up from the loader's location:
```html
<!-- Becomes './../modules/mymodule.mjs' -->
<div data-requires="./modules/mymodule.mjs"></div>
```

### 3. CSP/Nonce Support
If a global `SITE_NONCE` variable exists, it's appended for Content Security Policy compliance:
```javascript
<script>const SITE_NONCE = 'your-nonce-here';</script>
// DOMule adds: ?nonce=your-nonce-here
```

### 4. Full URLs
Load from CDNs or external sources:
```html
<div data-requires="https://cdn.example.com/module.mjs"></div>
```

## Debug Mode

Enable comprehensive logging with `?debug=true`:

```
https://yoursite.com/page.html?debug=true
```

**Debug mode provides:**
- Detailed module loading logs
- Color-coded console output
- Error stack traces
- Cache-busting (forces fresh downloads)
- Performance timing

**Example output:**
```
[dynImports] Importing module.mjs...
[myModule] Imported.
[myModule] Initializing for 3 element(s).
[myModule] Initialized, module said: Ready
```

## Lazy Loading

Use `data-require-lazy="true"` to defer loading until elements are visible:

```html
<!-- Only loads when video scrolls into view -->
<video data-requires="./videoplayer.mjs" data-require-lazy="true">
  <source src="video.mp4">
</video>
```

**How it works:**
1. Module is not loaded initially
2. Visibility watcher monitors the element
3. When visible, module loads and `init()` is called
4. Watcher is removed to prevent memory leaks

**Uses IntersectionObserver** when available (Chrome 61+, Safari 10.1+, Firefox 60+), falls back to scroll events.

## Using Third-Party Modules

DOMule works with any ES6 module, not just custom ones:

```html
<!-- Load Bootstrap components -->
<div data-requires="bootstrap/js/src/collapse.js">
  <button data-bs-toggle="collapse" data-bs-target="#demo">
    Toggle
  </button>
  <div class="collapse" id="demo">Content</div>
</div>

<!-- Load from CDN -->
<div data-requires="https://cdn.jsdelivr.net/npm/lodash@4.17.21/+esm">
  <!-- Your content -->
</div>
```

Third-party modules without an `init()` function simply execute their top-level code.

## Module Template

Use `_template.mjs` as a starting point:

```javascript
import {isVisible} from "./util.observe.mjs";
import events from "./core.events.mjs";
import {logger} from "./core.log.mjs";

export const NAME = 'exampleModule';

export function init(elements) {
  // Your code here
  
  // Optional: listen for events
  events.addListener('docShift', () => {
    elements.forEach(element => {
      // Do something on scroll/resize
    });
  });
  
  // Optional: return status
  return 'Module ready';
}
```

## Available Events

The event handler (`core.events.mjs`) provides:

- **`docReady`** – DOM content loaded
- **`docLoaded`** – All resources loaded (including images)
- **`imgsLoaded`** – All non-lazy images loaded
- **`docShift`** – Combined resize/scroll/visibility change
- **`startResize`, `resize`, `endResize`** – Window resize phases
- **`bodyResize`** – Body element dimension changes
- **`startScroll`, `scroll`, `endScroll`** – Scroll phases
- **`docBlur`, `docFocus`** – Document visibility changes
- **`breakPointChange`** – Responsive breakpoint changes

**Usage:**
```javascript
import events from './core.events.mjs';

events.addListener('resize', (e) => {
  console.log('Window resized');
});

// Or use shorthand
events.docReady(() => {
  console.log('DOM ready');
});
```

## Migration Guide (v2.x → v3.0)

Version 3.0 introduces a new module naming scheme. **All old imports still work** but log deprecation warnings.

### Import Path Changes

| Old Path | New Path | Type |
|----------|----------|------|
| `hnl.domscanner.mjs` | `core.scanner.mjs` | Core |
| `hnl.dynamicimports.mjs` | `core.loader.mjs` | Core |
| `hnl.eventhandler.mjs` | `core.events.mjs` | Core |
| `hnl.logger.mjs` | `core.log.mjs` | Core |
| `hnl.helpers.mjs` | `util.observe.mjs`, `util.dom.mjs`, etc. | Utils |
| `hnl.debounce.mjs` | `util.debounce.mjs` | Util |
| `hnl.colortool.mjs` | `util.color.mjs` | Util |

### Named Export Changes

| Old Export | New Export |
|------------|------------|
| `import {hnlLogger}` | `import {logger}` |
| `import eventHandler` | `import events` |

### Migration Timeline

- **Now – 3 months:** Old paths work, console warnings appear
- **After 3 months:** Old paths removed (breaking change, v4.0.0)

### Example Migration

**Before (still works):**
```javascript
import {hnlLogger} from './hnl.logger.mjs';
import {isVisible} from './hnl.helpers.mjs';
import eventHandler from './hnl.eventhandler.mjs';

hnlLogger.log('Example', 'Message');
eventHandler.docReady(() => {});
```

**After:**
```javascript
import {logger} from './core.log.mjs';
import {isVisible} from './util.observe.mjs';
import events from './core.events.mjs';

logger.log('Example', 'Message');
events.docReady(() => {});
```

## Troubleshooting

### Module doesn't load
**Check:**
- Browser console for errors (enable `?debug=true`)
- Path is correct (remember `./` becomes `./../`)
- Module is valid ES6 with `export` statements
- No syntax errors

### `init()` not called
**Verify:**
- Function is named `init` (case-sensitive)
- Function signature: `export function init(elements){}`
- Check console for initialization errors

### Lazy loading not working
**Common causes:**
- Element already visible on load (watcher never triggers)
- Element has `display: none`
- Typo: use `data-require-lazy="true"` (not `data-requires-lazy`)

### Performance issues
**Optimize:**
- Use lazy loading for below-fold content
- Minimize number of small modules (bundle related functionality)
- Disable debug mode in production
- Use browser cache

## Notes

This is a personal repository for maintaining the module system. Feel free to use it, but note: modules may change without prior notice.

---

**Version:** 3.0.0  
**License:** MIT  
**Author:** Klaas Leussink / hnldesign
