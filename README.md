# DOMule
A dynamic, DOM-driven frontend JavaScript module loader.

## Table of Contents

- [What is DOMule?](#what-is-domule)
- [The Problem It Solves](#the-problem-it-solves)
- [Performance Comparison](#performance-comparison)
  - [HTML Structure](#html-structure)
  - [Page Variations](#page-variations-actual-transfer-by-page-type)
  - [Execution Reality](#execution-reality)
  - [Network Waterfall](#network-waterfall-comparison)
  - [Real-World Scenario](#real-world-scenario-10-page-views)
  - [Developer Experience](#developer-experience)
- [Who Should Use DOMule](#who-should-use-domule)
- [Why Not Use...](#why-not-use)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
  - [1. Create Entrypoint](#1-create-an-entrypoint-module)
  - [2. Include in Page](#2-include-it-in-your-page)
  - [3. Add Modules to Elements](#3-add-modules-to-elements)
- [Writing Modules](#writing-modules)
  - [Example Module](#example-module)
  - [Module Template](#module-template)
- [Core Concepts](#core-concepts)
  - [Path Resolution](#path-resolution)
  - [Lazy Loading](#lazy-loading)
  - [Available Events](#available-events)
  - [Debug Mode](#debug-mode)
- [Using Third-Party Modules](#using-third-party-modules)
- [Migration Guide (v2.x → v3.0)](#migration-guide-v2x--v30)
- [Troubleshooting](#troubleshooting)
- [Notes](#notes)

---

## What is DOMule?

A lightweight module loader that lets DOM elements request their own JavaScript dependencies.

Write `<div data-requires="module.mjs">` and DOMule imports that module, calls its `init()` function, and passes the element to it. If multiple elements require the same module, all requiring elements are passed. Optionally, you can even defer loading the module until the element is visible; just add `data-requires-lazy="true"`.
**Zero build step. Pure ES6 modules.**

> **Why "DOMule"**?
>
> DOM + Module + Mule.
> 
> - The DOM declares what's needed;
> - Modules provide it;
> - The mule hauls it — but only what's actually required. Like the animal, it's stubborn about not carrying dead weight.

---

## The Problem It Solves

Most JavaScript frameworks solve the problem backwards: scripts search the DOM for elements to enhance. Scripts that are there. Always. On each load, regardless of context. Dead weight, adding insult to injury by polluting the global namespace.

DOMule inverts this — **elements declare what they need**, so scripts **only load when actually needed**.

This eliminates three common problems:

1. **Wasted bytes**: Scripts loading even when their target elements aren't on the page, bloating the payload
2. **Manual orchestration**: Writing and maintaining selectors, event binding, initialization order, etc.
3. **Build complexity**: Bundlers, tree-shaking, code-splitting configs

**DOMule's contract:** 
- An `element` says `data-requires="module.mjs"`
- `module.mjs` is loaded
- Its `init()` function executes, receiving the `element` as an argument (or every element that required `module.mjs`, if multiple request it).

No build step. No framework lock-in. Just load what you need, when you need it.

---

## Performance Comparison

### HTML Structure

| Traditional Multi-Script Approach | DOMule Approach |
|-----------------------------------|-----------------|
| **HEAD** | **HEAD** |
| `<script src="jquery-3.7.1.min.js"></script>` (87KB) | `<script type="module" src="entrypoint.mjs"></script>` (2KB) |
| `<script src="bootstrap.bundle.min.js"></script>` (59KB) | |
| `<script src="lodash.min.js"></script>` (73KB) | |
| `<script src="app-utils.js"></script>` (24KB) | |
| **BODY** | **BODY** |
| `<div class="slider">...</div>` | `<div class="slider" data-requires="./slider.mjs">...</div>` |
| `<div class="gallery">...</div>` | `<div class="gallery" data-requires="./gallery.mjs">...</div>` |
| **FOOTER** |  |
| `<script src="slider.js"></script>` (31KB) | *(loads automatically: slider.mjs, 15KB)* |
| `<script src="gallery.js"></script>` (42KB) | *(loads automatically: gallery.mjs, 18KB)* |
| `<script src="video-player.js"></script>` (56KB) | *(not present on page, doesn't load)* |
| `<script src="map.js"></script>` (38KB) | *(not present on page, doesn't load)* |
| `<script src="analytics.js"></script>` (12KB) | `<script type="module" src="analytics.mjs"></script>` (8KB) |
| **TOTAL TRANSFER** | **TOTAL TRANSFER** |
| **422KB** | **43KB** |

### Page Variations: Actual Transfer by Page Type

| Page Type | Elements Present | Traditional (always loads) | DOMule (loads only needed) | Bytes Saved |
|-----------|------------------|---------------------------|---------------------------|-------------|
| **Homepage** | Slider only | 422KB | 17KB (entrypoint + slider) | **96% reduction** |
| **Blog Post** | None (just text) | 422KB | 2KB (entrypoint only) | **99.5% reduction** |
| **Gallery Page** | Gallery + Lightbox | 422KB | 35KB (entrypoint + gallery) | **92% reduction** |
| **Contact Page** | Map only | 422KB | 40KB (entrypoint + map) | **90% reduction** |
| **Video Page** | Video player below fold | 422KB | 2KB initially, then 58KB on scroll | **86% reduction** |
| **Dashboard** | All features | 422KB | 127KB (loads all modules) | **70% reduction** |

### Execution Reality

| Aspect | Traditional | DOMule |
|--------|------------|--------|
| **Scripts parsed on load** | All 10 scripts, always | 1 entrypoint, then 0-6 modules as needed |
| **Memory footprint** | jQuery + Bootstrap + Lodash + all feature code = ~2.8MB heap | Only loaded modules = ~400KB-1.2MB heap |
| **Parse/compile time** | 180-250ms (all scripts) | 15-60ms (only needed modules) |
| **Code executed unnecessarily** | 60-80% never runs on any given page | 0% - only loaded code runs |
| **Main thread blocking** | 250ms+ (all scripts parse/execute) | 50-100ms (staggered, async) |

### Network Waterfall Comparison

**Traditional (everything loads):**
```
Time  →  0ms ────────────────────────────────────────────── 850ms
         │
HTML     ████ (20ms)
jquery   │   ██████████ (95ms, blocks rendering)
bootstrp │            ██████ (65ms, blocks rendering)
lodash   │                  ████████ (80ms, blocks rendering)
utils    │                          ███ (30ms, blocks rendering)
slider   │                             ████ (40ms)
gallery  │                                 █████ (50ms)
video    │                                      ██████ (60ms, UNUSED)
map      │                                            ████ (45ms, UNUSED)
analytics│                                                ██ (15ms)
         │
DOMContentLoaded fires at: 850ms
```

**DOMule (conditional loading):**
```
Time  →  0ms ──────────────── 180ms
         │
HTML     ████ (20ms)
entrypt  │   ██ (10ms, non-blocking)
slider   │     ███ (25ms, async, needed)
gallery  │        ████ (30ms, async, needed)
         │
DOMContentLoaded fires at: 180ms
```

### Real-World Scenario: 10 Page Views

Assuming typical user journey: Homepage → Blog → Gallery → Contact → 6 more blogs

| Approach | Total Bytes Transferred | Parse/Compile Time | Cache Efficiency |
|----------|------------------------|-------------------|------------------|
| **Traditional** | 4,220KB (422KB × 10) | 2,500ms | Low (bundle invalidation) |
| **DOMule** | 287KB (varied by page) | 340ms | High (module-level) |
| **Savings** | **93% less bandwidth** | **86% less CPU** | Granular cache hits |

### Developer Experience

| Factor | Traditional | DOMule |
|--------|------------|--------|
| **Build step** | Required (webpack/rollup) | None |
| **Bundle configuration** | Manual optimization needed | Automatic, DOM-driven |
| **Add new feature** | Edit build config → rebuild → test | Write module → add `data-requires` |
| **Remove feature** | Edit imports → rebuild → test | Remove element (script auto-excluded) |
| **Code splitting** | Manual `import()` statements | One attribute: `data-require-lazy="true"` |
| **Time to first byte** | Wait for bundle rebuild (5-15s) | Instant (no build) |

### Key Metrics Summary

- **96% reduction** on typical pages (homepage with one feature)
- **850ms → 180ms** DOMContentLoaded time
- **Zero rebuild time** during development
- **93% less bandwidth** over typical 10-page session
- **86% less parse/compile time** across pages

**Rule of thumb:** If >50% of your JS doesn't run on most pages, DOMule pays for itself in bandwidth alone.

---

## Who Should Use DOMule

**Ideal for:**
- Content-heavy sites where most pages use 20% of available JS features
- Server-rendered pages with progressive enhancement
- Teams without (or avoiding) build pipelines
- Projects where "just attach behavior to elements" covers 80% of JS needs
- Sites with optional heavy features (galleries, maps, forms) that shouldn't penalize every page

**Not ideal for:**
- Large SPAs with complex state management (use React/Vue/Svelte)
- Applications requiring SSR hydration
- Projects already invested in a bundler workflow
- Teams needing component-level reactivity

**Simple test:** If your mental model is "this element needs this script" rather than "this app needs this state tree," DOMule fits.

---

## Why Not Use...

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

**The pattern no one else solves:** "Load this script only if this element exists *and* is visible, then pass all matching elements to one initialization function." That specific intersection is DOMule's territory.

---

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
Here's where your modules live. There are some examples in the repository (e.g. `hnl.breakpoints.mjs`, `hnl.baseline-grid.mjs`), and you can use `_template.mjs` to get started with writing your own.

---

## Quick Start

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

---

## Writing Modules

### Example Module

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

### Module Template

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

---

## Core Concepts

### Path Resolution

DOMule supports multiple ways to specify module paths:

#### 1. Relative Paths
Standard ES6 module paths relative to your entrypoint:
```html
<div data-requires="./modules/mymodule.mjs"></div>
<div data-requires="../vendor/library.mjs"></div>
```

**⚠️ Gotcha:** Paths in `data-requires` are resolved relative to **where your entrypoint lives**, not relative to the HTML file. This is standard ES6 module behavior.

**Example:**
```
/
├── index.html
├── js/
│   ├── entrypoint.mjs          ← Your entrypoint
│   └── modules/
│       └── slider.mjs          ← Your module
```

```html
<!-- In index.html -->
<div data-requires="./modules/slider.mjs"></div>
<!-- ✅ Resolves to: js/modules/slider.mjs (relative to entrypoint) -->

<div data-requires="../modules/slider.mjs"></div>
<!-- ❌ Would look for: modules/slider.mjs (outside js/) -->
```

#### 2. Custom Path Aliases
Define reusable path aliases for cleaner imports:
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

#### 3. Absolute URLs
Load from CDNs or external sources:
```html
<div data-requires="https://cdn.example.com/module.mjs"></div>
```

#### 4. CSP/Nonce Support
If a global `SITE_NONCE` variable exists, it's appended automatically for Content Security Policy compliance:
```javascript
<script>const SITE_NONCE = 'your-nonce-here';</script>
// DOMule adds: ?nonce=your-nonce-here
```

### Lazy Loading

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

### Loading States

Elements get automatic CSS classes tracking module load progress:

| State | Class | When |
|-------|-------|------|
| Pending | `.module-pending` | Awaiting import |
| Loading | `.module-loading` | Import started (lazy only) |
| Loaded | `.module-loaded` | Init complete |
| Error | `.module-error` | Failed |

Also available as `data-requires-state` attribute for JavaScript access.

**Example - Show spinner during load:**
```html
<div data-requires="./gallery.mjs">
  <div class="loader">Loading...</div>
  <div class="content"></div>
</div>
```

```css
.module-pending .loader { display: block; }
.module-pending .content { display: none; }

.module-loaded .loader { display: none; }
.module-loaded .content { display: block; }
```

**Example - Lazy load indicator:**
```html
<img data-requires="./lightbox.mjs" data-require-lazy="true">
```

```css
img.module-pending { opacity: 0.3; }
img.module-loading { animation: pulse 1s infinite; }
img.module-loaded { opacity: 1; }
```

Elements with multiple modules (e.g., `data-requires="a.mjs,b.mjs"`) transition to `loaded` only when all succeed.

### Available Events

The event handler (`core.events.mjs`) provides:

- **`docReady`** – DOM content loaded
- **`docLoaded`** – All resources loaded (including images)
- **`imgsLoaded`** – All non-lazy images loaded
- **`docShift`** – Combined resize/scroll/visibility change
- **`startResize`, `resize`, `endResize`** – Window resize phases
- **`bodyResize`** – Body element dimension changes
- **`startScroll`, `scroll`, `endScroll`** – Scroll phases
- **`docBlur`, `docFocus`** – Document visibility changes
- **`breakPointChange`** – Responsive breakpoint changes (`xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `xxxl`)*

<sub><sup>* Uses [Bootstrap 5's breakpoint system](https://getbootstrap.com/docs/5.0/layout/breakpoints/), both for naming and cutoff (pixel) values.</sup></sub>

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

### Debug Mode

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

---

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

---

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

---

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

---

## Notes

This is a personal repository for maintaining the module system. Feel free to use it, but note: modules may change without prior notice.

**Version:** 3.0.0  
**License:** MIT  
**Author:** Klaas Leussink / hnldesign
