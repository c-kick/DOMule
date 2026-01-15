# DOMule

A lightweight module loader that lets DOM elements request their own JavaScript dependencies.

![Chrome 61+](https://img.shields.io/badge/Chrome-61+-green?logo=googlechrome)
![Safari 12.1+](https://img.shields.io/badge/Safari-12.1+-blue?logo=safari)
![Firefox 60+](https://img.shields.io/badge/Firefox-60+-orange?logo=firefox)
![Edge 16+](https://img.shields.io/badge/Edge-16+-blue?logo=microsoftedge)

<img src="https://code.hnldesign.nl/domule/DOMule.png" width=800>

## Table of Contents

- [What is DOMule?](#what-is-domule)
- [The Problem It Solves](#the-problem-it-solves)
- [Performance Comparison](#performance-comparison)
- [Who Should Use DOMule](#who-should-use-domule)
- [Why Not Use...](#why-not-use)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Writing Modules](#writing-modules)
- [Core Concepts](#core-concepts)
  - [Path Resolution](#path-resolution)
  - [Minified-first loading](#minified-first-loading)
  - [Lazy Loading](#lazy-loading)
  - [Loading States](#loading-states)
  - [Available Events](#available-events)
  - [Module Self-Destruction](#module-self-destruction)
  - [Debug Mode](#debug-mode)
- [Inter-Module Communication (module API)](#inter-module-communication)
- [Using Third-Party Modules](#using-third-party-modules)
- [Migration Guide (v2.x → v3.0)](#migration-guide-v2x--v30)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [DOM... what?](#so-why-is-it-called-domule)
- [Notes](#notes)

---

## What is DOMule ?

DOMule enables any DOM element to request JavaScript modules, so the page loads scripts only for the elements that
actually require them. This eliminates massive amounts of overhead in loading scripts that you don't (always) need.

### Meaning...?

Write `<div data-requires="module.mjs">` and DOMule imports that module, calls its `init()` function, and passes the
element to it. If multiple elements require the same module, all requiring elements are passed. Optionally, you can even
defer loading the module until the element is visible; just add `data-require-lazy="true"`.

Zero build step. Pure ES6 modules.

---

## The Problem It Solves

Most JavaScript frameworks solve the problem backwards: scripts search the DOM for elements to enhance. Scripts that are
there. Always. On each load, regardless of context. Dead weight, adding insult to injury by polluting the global
namespace.

DOMule inverts this — **elements declare what they need**, so scripts **only load when actually needed**.

This eliminates three common problems:

1. **Wasted bytes**: Scripts loading even when their target elements aren't on the page, bloating the payload
2. **Manual orchestration**: Writing and maintaining selectors, event binding, initialization order, etc.
3. **Build complexity**: Bundlers, tree-shaking, code-splitting configs

**DOMule's contract:**

- An `element` says `data-requires="module.mjs"`
- `module.mjs` is loaded
- Its `init()` function executes, receiving the `element` as an argument (or every element that required `module.mjs`,
  if multiple request it).

No build step. No framework lock-in. Just load what you need, when you need it.

---

## Performance Comparison

### HTML Structure

| Traditional Multi-Script Approach                        | DOMule Approach                                                |
|----------------------------------------------------------|----------------------------------------------------------------|
| **HEAD**                                                 | **HEAD**                                                       |
| `<script src="jquery-3.7.1.min.js"></script>` (87KB)     | `<script type="module" src="entrypoint.mjs"></script>` (2KB)   |
| `<script src="bootstrap.bundle.min.js"></script>` (59KB) |                                                                |
| `<script src="lodash.min.js"></script>` (73KB)           |                                                                |
| `<script src="app-utils.js"></script>` (24KB)            |                                                                |
| **BODY**                                                 | **BODY**                                                       |
| `<div class="slider">...</div>`                          | `<div class="slider" data-requires="./slider.mjs">...</div>`   |
| `<div class="gallery">...</div>`                         | `<div class="gallery" data-requires="./gallery.mjs">...</div>` |
| **FOOTER (i.e. just before `</body>`)**                  |                                                                |
| `<script src="slider.js"></script>` (31KB)               | *(loads automatically: slider.mjs, 15KB)*                      |
| `<script src="gallery.js"></script>` (42KB)              | *(loads automatically: gallery.mjs, 18KB)*                     |
| `<script src="video-player.js"></script>` (56KB)         | *(not present on page, doesn't load)*                          |
| `<script src="map.js"></script>` (38KB)                  | *(not present on page, doesn't load)*                          |
| **TOTAL TRANSFER**                                       | **TOTAL TRANSFER**                                             |
| **410KB**                                                | **35KB**                                                       |

### Page Variations: Actual Transfer by Page Type

| Page Type        | Elements Present        | Traditional (always loads) | DOMule (loads only needed)         | Bytes Saved         |
|------------------|-------------------------|----------------------------|------------------------------------|---------------------|
| **Homepage**     | Slider only             | 422KB                      | 17KB (entrypoint + slider)         | **96% reduction**   |
| **Blog Post**    | None (just text)        | 422KB                      | 2KB (entrypoint only)              | **99.5% reduction** |
| **Gallery Page** | Gallery + Lightbox      | 422KB                      | 35KB (entrypoint + gallery)        | **92% reduction**   |
| **Contact Page** | Map only                | 422KB                      | 40KB (entrypoint + map)            | **90% reduction**   |
| **Video Page**   | Video player below fold | 422KB                      | 2KB initially, then 58KB on scroll | **86% reduction**   |
| **Dashboard**    | All features            | 422KB                      | 127KB (loads all modules)          | **70% reduction**   |

### Execution Reality

| Aspect                          | Traditional                                                  | DOMule                                   |
|---------------------------------|--------------------------------------------------------------|------------------------------------------|
| **Scripts parsed on load**      | All 10 scripts, always                                       | 1 entrypoint, then 0-6 modules as needed |
| **Memory footprint**            | jQuery + Bootstrap + Lodash + all feature code = ~2.8MB heap | Only loaded modules = ~400KB-1.2MB heap  |
| **Parse/compile time**          | 180-250ms (all scripts)                                      | 15-60ms (only needed modules)            |
| **Code executed unnecessarily** | 60-80% never runs on any given page                          | 0% - only loaded code runs               |
| **Main thread blocking**        | 250ms+ (all scripts parse/execute)                           | 50-100ms (staggered, async)              |

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

| Approach        | Total Bytes Transferred | Parse/Compile Time | Cache Efficiency          |
|-----------------|-------------------------|--------------------|---------------------------|
| **Traditional** | 4,220KB (422KB × 10)    | 2,500ms            | Low (bundle invalidation) |
| **DOMule**      | 287KB (varied by page)  | 340ms              | High (module-level)       |
| **Savings**     | **93% less bandwidth**  | **86% less CPU**   | Granular cache hits       |

### Developer Experience

| Factor                   | Traditional                        | DOMule                                    |
|--------------------------|------------------------------------|-------------------------------------------|
| **Build step**           | Required (webpack/rollup)          | None                                      |
| **Bundle configuration** | Manual optimization needed         | Automatic, DOM-driven                     |
| **Add new feature**      | Edit build config → rebuild → test | Write module → add `data-requires`        |
| **Remove feature**       | Edit imports → rebuild → test      | Remove element (script auto-excluded)     |
| **Code splitting**       | Manual `import()` statements       | One attribute: `data-require-lazy="true"` |
| **Time to first byte**   | Wait for bundle rebuild (5-15s)    | Instant (no build)                        |

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
- Theme developers wanting to offer optional JS features without bloat 
  - Escaping the confines of Wordpress' JavaScript ecosystem
- Server-rendered pages with progressive enhancement
- Teams without (or avoiding) build pipelines
- Projects where "just attach behavior to elements" covers 80% of JS needs
- Sites with optional heavy features (galleries, maps, forms) that shouldn't penalize every page
- Anyone concerned with optimizing their page load times and willing to squeeze every last KB out of it

**Not ideal for:**

- Large SPAs with complex state management (use React/Vue/Svelte)
- Applications requiring SSR hydration
- Projects already invested in a bundler workflow
- Teams needing component-level reactivity

**Simple test:** If your mental model is "this element needs this script" rather than "this app needs this state tree,"
DOMule fits.

---

## Why Not Use...

### Stimulus.js

**What it does:** Controllers attach to `data-controller` attributes with lifecycle callbacks, targets, and actions.

**Key difference:** Stimulus is a full framework for organizing behavior. DOMule is just a loader—it imports modules and
calls `init()`, then gets out of the way. No lifecycle, no targets, no framework opinions. If you need structure, use
Stimulus. If you just need "load this when that appears," DOMule is lighter.

### Alpine.js

**What it does:** Declarative reactivity via data attributes (`x-data`, `x-show`, `x-model`).

**Key difference:** Alpine handles UI state and interactivity. DOMule handles *module loading*. Alpine is always present
on the page; DOMule modules only load when needed. You'd use Alpine for reactive components, DOMule for loading the
scripts that power them (or not loading them if they're not on the page).

### RequireJS/AMD

**What it does:** Asynchronous module loading with dependency management via `define()` and `require()`.

**Key difference:** RequireJS uses programmatic, script-driven loading (`require(['module'], callback)`). DOMule uses
*DOM-driven* loading (`data-requires="module"`). RequireJS requires wrapping everything in AMD syntax. DOMule uses
native ES6 modules. RequireJS solves "load dependencies in order." DOMule solves "only load what's on the page."

### Webpack Code Splitting

**What it does:** Build-time analysis to split bundles and lazy-load chunks via `import()`.

**Key difference:** Webpack decides splits during build based on static analysis. DOMule decides at *runtime* based on
viewport visibility. Webpack requires a *build* step and toolchain. DOMule runs in the browser with zero build. Webpack
optimizes bundles. DOMule optimizes *page load* by not loading scripts for absent elements.

**The pattern no one else solves:** "Load this script only if this element exists *and* is visible, then pass all
matching elements to one initialization function." That specific intersection is DOMule's territory.

---

## Architecture

DOMule uses a three-tier module architecture:

### 1. Core Tier (`core.*`)

System infrastructure required for DOMule to function:

- **`core.scanner.mjs`** – Discovers elements with `data-requires` attributes
- **`core.loader.mjs`** – Orchestrates module imports and initialization
- **`core.events.mjs`** – Manages lifecycle events (docReady, resize, scroll, etc.)
- **`core.registry.mjs`** - Keeps track of modules, and handles module [api](#inter-module-communication).
- **`core.log.mjs`** – Provides colored console logging (enabled via `?debug=true`)
- **`core.telemetry.mjs`** – Performance tracking, budget monitoring, metrics dashboard

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
- **`util.mediainfo.mjs`** – CSS media query wrapper (prefers-reduced-motion, etc.)
- **`util.ensure-visibility.mjs`** – Viewport scrolling with header detection
- **`util.polyfills.mjs`** – Compatibility patches (auto-imports, no init needed)


### 3. Module Tier

Here's where your modules live. There are some examples in the repository (e.g. `hnl.breakpoints.mjs`,
`hnl.baseline-grid.mjs`), and you can use `_template.mjs` to get started with writing your own.

---

## Quick Start

### 1. Download all `core.` and `util.` modules

Place them somewhere in your project, presumably something like `/assets/js/domule/`.

### 1. Create an entrypoint module

> **Heads-up!**
>
> Location of the entrypoint does not really matter, but there's one caveat: module paths, as requested
> by DOM elements in their `data-requires` are resolved **relative to this entrypoint**.
> So if your entrypoint is in `/assets/js/entrypoint.mjs`, and you have a module in
> `/assets/js/modules/mymodule.mjs`, you would use `data-requires="./modules/mymodule.mjs"`.
> 
> See [Path Resolution](#path-resolution) for more info.

For the sake of this example, I will assume the entrypoint is at `/assets/js/entrypoint.mjs`, and domule lives in
`/assets/js/domule/`.

```javascript
// entrypoint.mjs
import events from './domule/core.events.mjs'; //make sure this path is correct
import {loadModules} from './domule/core.loader.mjs'; //make sure this path is correct

events.docReady(() => {
    // Handle all dynamic module imports
    loadModules({
        'assets': 'https://cdn.example.com/js/' // Optional: path aliases
    }, (results) => {
        console.log(`${results.loaded.length} modules initialized`);
        if (results.failed.length > 0) {
            console.warn('Failed modules:', results.failed.map(f => f.path));
        }
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
<!-- Loose: viewport only (default) -->
<div data-requires="./gallery.mjs" data-require-lazy="true">
<!-- or: ("loose" and "true" do the same)-->
<div data-requires="./gallery.mjs" data-require-lazy="loose">

<!-- Strict: viewport + rendered visibility -->
<div data-requires="./modal.mjs" data-require-lazy="strict">
```

---

## Writing Modules

### Example Module

```javascript
/**
 * example-module.mjs
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
 * @param {HTMLElement[]} elements - All elements with data-requires="./example-module.mjs"
 * @param {Object|null} context - null for immediate loads, or {isLazy, triggeringElement} for lazy loads
 * @returns {string|boolean|undefined} Optional status message
 */
export function init(elements, context) {
    // For lazy-loaded modules, context contains the triggering element
    if (context?.isLazy) {
        logger.log(NAME, `Lazy loaded by: ${context.triggeringElement.tagName}`);
    }

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

/**
 * @param {HTMLElement[]} elements - All elements requiring this module
 * @param {Object|null} context - Lazy load context (null for immediate loads)
 * @param {boolean} context.isLazy - True if lazy-loaded
 * @param {HTMLElement} context.triggeringElement - Element that triggered lazy load
 */
export function init(elements, context) {
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

**⚠️ Gotcha:** Paths in `data-requires` are resolved relative to **where your entrypoint lives**, not relative to the
HTML file. This is standard ES6 module behavior.

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
loadModules({
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

### Minified-first loading

DOMule has a "minified-first" strategy on module importing; it automatically tries loading minified versions (
`.min.mjs`)
first, and falls back to unminified versions if a minified version is not found.

So for `<div data-requires="./module.mjs"></div>`, DOMule will first try to fetch `module.min.js`,
falling back to `module.mjs` if that fails.

The "attempt-then-fallback" pattern is superior to probing for a minified version first, because:

1. **Fewer requests** - Probe = 2 requests (HEAD + GET), fallback = 1-2 requests (GET + optional retry)
2. **Simpler code** - No HEAD request handling, just catch/retry
3. **Better caching** - Browser caches GET responses, not HEAD
4. **Race-free** - No timing issues between probe and actual import

One request per module is the cost of doing business. The fallback only fires when minified is genuinely missing,
which should be rare in production (assuming you deploy both versions).

#### Disable in development

Enabling [debug mode](#debug-mode) completely disables the "minified-first" import behaviour and always loads unminified
modules (i.e.: the exact path definition in `data-requires`).

### Lazy Loading

Use `data-require-lazy` to defer loading until elements are visible:

```html
<!-- Only loads when video scrolls into view -->
<video data-requires="./videoplayer.mjs" data-require-lazy="true">
    <source src="video.mp4">
</video>
```

- `"true"` or `"loose"` - Standard IntersectionObserver (viewport intersection only)
- `"strict"` - Adds obstruction checking (viewport + rendered visibility + transition/animation detection)

Use `"strict"` mode for elements that:
- Animate from `opacity: 0` to visible
- Are revealed via `display: none → block`
- Appear from off-canvas (hidden by parent overflow)
- Show/hide via modals or overlays

**How it works:**

1. Module is not loaded initially
2. Visibility watcher monitors the element
3. When visible, module loads and `init()` is called
4. Watcher is removed to prevent memory leaks

**Uses IntersectionObserver** when available (Chrome 61+, Safari 12.1+, Firefox 60+), falls back to scroll events.

### Loading States

Elements get automatic CSS classes tracking module load progress:

| State   | Class             | When                       |
|---------|-------------------|----------------------------|
| Pending | `.module-pending` | Awaiting import            |
| Loading | `.module-loading` | Import started (lazy only) |
| Loaded  | `.module-loaded`  | Init complete              |
| Error   | `.module-error`   | Failed                     |

Also available as `data-requires-state` attribute for JavaScript access.

**Example - Show spinner during load:**

```html

<div data-requires="./gallery.mjs">
    <div class="loader">Loading...</div>
    <div class="content"></div>
</div>
```

```css
.module-pending .loader {
    display: block;
}

.module-pending .content {
    display: none;
}

.module-loaded .loader {
    display: none;
}

.module-loaded .content {
    display: block;
}
```

**Example - Lazy load indicator:**

```html
<img data-requires="./lightbox.mjs" data-require-lazy="true">
```

```css
img.module-pending {
    opacity: 0.3;
}

img.module-loading {
    animation: pulse 1s infinite;
}

img.module-loaded {
    opacity: 1;
}
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

<sub><sup>* Uses [Bootstrap 5's breakpoint system](https://getbootstrap.com/docs/5.0/layout/breakpoints/), both for
naming and cutoff (pixel) values.</sup></sub>

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

### Module Self-Destruction

Modules can clean up and unregister themselves when no longer needed:

```javascript
export const NAME = 'gallery';

let observer, animationId, listeners = [];

export function init(elements) {
    // Setup
    observer = new IntersectionObserver(/*...*/);
    animationId = requestAnimationFrame(animate);

    elements.forEach(el => {
        el.addEventListener('click', handleClick);
        listeners.push({el, handler: handleClick});
    });
}

export function destroy() {
    // Clean up resources
    observer?.disconnect();
    cancelAnimationFrame(animationId);
    listeners.forEach(({el, handler}) => {
        el.removeEventListener('click', handler);
    });

    // Unregister from module system
    ModuleRegistry.unregister(NAME);
}

// Module decides when to self-destruct
someCondition && destroy();
```

Note: `ModuleRegistry.unregister()` rejects pending promises (i.e. `ModuleRegistry.waitFor()`)

### Debug Mode

Enable comprehensive logging with `?debug=true`:

```
https://yoursite.com/page.html?debug=true
```

**Debug mode provides:**

- Detailed module loading logs
- Color-coded console output
- Error stack traces
- Cache-busting (forces fresh downloads) - unless specifically overriden using `&cache=true`
- Performance timing

**Example output:**

```
[core][loader] Importing module.mjs...
[myModule] Imported.
[myModule] Initializing for 3 element(s).
[myModule] Initialized, module said: Ready
```

---

## Inter-Module Communication

DOMule provides a module registry for coordinated behavior between modules without tight coupling or global state
pollution.

### The Problem

Modules sometimes need to interact:

- A gallery loads images → lightbox needs to know they changed
- Analytics needs to track when video player starts
- Form validation needs to check if CAPTCHA module is ready

Without coordination, you'd resort to:

- Global variables (namespace pollution)
- DOM events (coarse, no type safety)
- Manual initialization order (brittle)

### The Solution: Module Registry + `api()` Convention

**Registry provides:**

- Discovery: check if modules are loaded
- Waiting: block until dependencies are ready
- Access: get module exports safely

**The `api()` function:**

- Single standardized entry point per module
- Module defines what actions it supports
- Other modules call `moduleA.api('actionName', ...args)`

---

### Basic Usage

Besides an `init()` export, a module providing coordination
(gallery.mjs in the example above) simply exports an additional `api()` function:

```javascript
export const NAME = 'gallery';

let images = [];
let changeCallbacks = [];

/**
 * Initialize module, as per the module standard
 */
export function init(elements) {
    images = loadImages(elements);
    return `Loaded ${images.length} images`;
}

/**
 * Additional (and optional) public API for inter-module coordination
 */
export function api(action, ...args) {
    switch (action) {
        case 'getImages':
            return images;

        case 'getCount':
            return images.length;

        case 'onChange':
            // Register callback for changes
            changeCallbacks.push(args[0]);
            break;

        case 'addImage':
            images.push(args[0]);
            changeCallbacks.forEach(cb => cb(images));
            break;

        default:
            logger.warn(NAME, `Unknown action: ${action}`);
    }
}
```

The module that needs to coordinate with this module (lightbox.mjs in the example above) can then simply do:

```javascript
import {ModuleRegistry} from './core.registry.mjs';

export const NAME = 'lightbox';

export function init(elements) {
    // Wait for gallery module (handles async)
    ModuleRegistry.waitFor('gallery')
        .then(gallery => {
            // Guaranteed: gallery exists AND has api()
            const images = gallery.api('getImages');
            initLightbox(elements, images);

            // React to changes
            gallery.api('onChange', (newImages) => {
                updateLightbox(newImages);
            });
        })
        .catch(error => {
            // Timeout, module error, or no api()
            logger.warn(NAME, `Gallery unavailable: ${error.message}`);
            // Degrade gracefully - work standalone
        });
}
```

### API Reference

`ModuleRegistry.waitFor(name, timeout)`

Waits for module to load and verify it has an `api()` interface.

**Parameters:**

- `name` (string) - Module name (from NAME export, or filename if no NAME)
- `timeout` (number) - Max wait time in ms (default: `30000`)

**Returns:** A `Promise` that resolves with module exports
**Rejects when:**

- Module doesn't load within timeout
- Module loads but has no `api()` function
- Module `init()` throws error (module has failed to initialize)

```javascript
// Promise chain style
ModuleRegistry.waitFor('gallery')
    .then(gallery => {
        gallery.api('getImages');
    })
    .catch(error => {
        console.warn('Gallery unavailable:', error);
    });

// Async/await style
try {
    const gallery = await ModuleRegistry.waitFor('gallery', 5000);
    const images = gallery.api('getImages');
} catch (error) {
    console.warn('Gallery unavailable:', error);
}
```

`ModuleRegistry.isLoaded(name)`

Check if module is loaded successfully (synchronous):

```javascript
if (ModuleRegistry.isLoaded('gallery')) {
    const gallery = ModuleRegistry.get('gallery');
    gallery.api('getImages');
}
```

`ModuleRegistry.get(name)`
Get module exports (or null if not loaded):

```javascript
const gallery = ModuleRegistry.get('gallery');
if (gallery && typeof gallery.api === 'function') {
    gallery.api('getImages');
}
```

`ModuleRegistry.getElements(name)`

Get all elements that required this module:

```javascript
const galleryElements = ModuleRegistry.getElements('gallery');
// → [div.gallery, section.photos, ...]

//alternatively:
ModuleRegistry.getElements('gallery').forEach(el => {
    // Do something with each element
});
```

`ModuleRegistry.getAll()`

Get all registered modules (debug helper).

```javascript
console.log(ModuleRegistry.getAll());
// → [{name: 'gallery', state: 'loaded', elementCount: 2}, ...]
```

### Common Patterns using the module API

#### Optional Dependencies

Load module if available, degrade if not:

```javascript
export function init(elements) {
    ModuleRegistry.waitFor('analytics', 2000)
        .then(analytics => {
// Track events through analytics
            trackWithAnalytics(analytics);
        })
        .catch(() => {
// Analytics not available, skip tracking
            console.log('Running without analytics');
        });
}
```

#### Multiple Dependencies

Wait for multiple modules in parallel:

```javascript
export async function init(elements) {
    try {
        const [gallery, lightbox] = await Promise.all([
            ModuleRegistry.waitFor('gallery'),
            ModuleRegistry.waitFor('lightbox')
        ]);

        // Both available
        coordinateModules(gallery, lightbox);

    } catch (error) {
        console.warn('Dependencies missing:', error);
    }
}
```

#### State Queries

Check without waiting:

```javascript
export function init(elements) {

// Initialize immediately
    setupFeature(elements);

// Check if optional module is present
    if (ModuleRegistry.isLoaded('theme')) {
        const theme = ModuleRegistry.get('theme');
        applyTheme(theme.api('getColors'));
    }
}
```

#### Callback Registration

Let other modules react to your events:

```javascript
// In video-player.mjs

let playCallbacks = [];

export function api(action, ...args) {
    switch (action) {
        case 'onPlay':
            playCallbacks.push(args[0]);
            break;
    }
}

function handlePlay() {
    playCallbacks.forEach(cb => cb({currentTime, duration}));
}

// In analytics.mjs
ModuleRegistry.waitFor('video-player')
    .then(player => {
        player.api('onPlay', (data) => {
            trackEvent('video_play', data);
        });
    });
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

## Migration Guide (v2.x → v3.x)

Version 3.0 introduced a new module naming scheme. All old imports still worked but logged deprecation warnings.
As of version 3.1, **old imports will no longer work**, as the backward-compatible module shims have
been *removed*. This is earlier than originally planned (v4.0) to reduce maintenance overhead.

### Import Path Changes

| v2.x                     | v3.x                                     | Type  |
|--------------------------|------------------------------------------|-------|
| `hnl.domscanner.mjs`     | `core.scanner.mjs`                       | Core  |
| `hnl.dynamicimports.mjs` | `core.loader.mjs`                        | Core  |
| `hnl.eventhandler.mjs`   | `core.events.mjs`                        | Core  |
| `hnl.logger.mjs`         | `core.log.mjs`                           | Core  |
| `hnl.helpers.mjs`        | `util.observe.mjs`, `util.dom.mjs`, etc. | Utils |
| `hnl.debounce.mjs`       | `util.debounce.mjs`                      | Util  |
| `hnl.colortool.mjs`      | `util.color.mjs`                         | Util  |

### Named Export Changes

| Old Export            | New Export             |
|-----------------------|------------------------|
| `import {hnlLogger}`  | `import {logger}`      |
| `import eventHandler` | `import events`        |
| `import {dynImports}` | `import {loadModules}` |

### Function Renames (v3.1+)

| Deprecated (v3.x) | New Name (v3.1+) | Removal |
|-------------------|------------------|---------|
| `dynImports()`    | `loadModules()`  | v4.0.0  |

The old `dynImports()` function still works in v3.x with a deprecation warning in debug mode.

### Example Migration

**Before:**

```javascript
import {hnlLogger} from 'nok-2025-v1/assets/js/modules/modules/hnl.logger.mjs';
import {isVisible} from 'nok-2025-v1/assets/js/modules/modules/hnl.helpers.mjs';
import eventHandler from 'nok-2025-v1/assets/js/modules/modules/hnl.eventhandler.mjs';

hnlLogger.log('Example', 'Message');
eventHandler.docReady(() => {
});
```

**After:**

```javascript
import {logger} from './core.log.mjs';
import {isVisible} from './util.observe.mjs';
import events from './core.events.mjs';
import {loadModules} from './core.loader.mjs';  // was {dynImports}, pre v3.1

logger.log('Example', 'Message');
events.docReady(() => {
    loadModules(() => {
        console.log('All modules loaded');
    });
});
```

### API Changes (v3.1.0)

**Function Renames:**
- `dynImports()` → `loadModules()` (deprecated, removed in v4.0)

**Backward Compatibility:**
```javascript
// Old code still works (with warning in debug mode)
import {dynImports} from './core.loader.mjs';
dynImports(() => console.log('loaded'));

// New recommended usage
import {loadModules} from './core.loader.mjs';
loadModules(() => console.log('loaded'));
```

---

## Deprecation Policy

- v3.0.0: Old imports work through shims, console warnings appear
- v3.1.0: Old paths removed (breaking change)
- v3.1.0: `dynImports()` deprecated, `loadModules()` introduced
- v4.0.0: `dynImports()` removed (planned)

---

## Browser Support

Core features require ES6 module support. Optional features degrade gracefully:

- IntersectionObserver (lazy loading) - Chrome 61+, Safari 12.1+
- ResizeObserver (body resize) - Chrome 64+, Safari 13.1+

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

- Element has `display: none;` or `visibility: hidden;`
- Typo: use `data-require-lazy="true"` (not `data-requires-lazy` - note the superflous 's')

### Performance issues

**Optimize:**

- Use lazy loading for below-fold content
- Minimize number of small modules (bundle related functionality)
- Disable debug mode in production
- Use browser cache

---

## Testing

DOMule includes a comprehensive test suite using [Vitest](https://vitest.dev/).

### Running Tests

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Test Structure

```
__tests__/
├── core.*.test.mjs       # Core module tests (loader, registry, events, etc.)
├── util.*.test.mjs       # Utility function tests (debounce, observe, format, etc.)
├── integration.test.mjs  # Full loading flow tests
└── module.compat.test.mjs # Module compatibility checker
```

### Testing Your Custom Modules

Validate that your module is compatible with DOMule:

```bash
# Linux/Mac
MODULE=./modules/mymodule.mjs npm run test:module

# Windows CMD
set MODULE=./modules/mymodule.mjs && npm run test:module

# PowerShell
$env:MODULE="./modules/mymodule.mjs"; npm run test:module
```

This checks for:
- Required `NAME` export
- Valid `init(elements, context)` signature
- Optional `api()` and `destroy()` functions
- ModuleRegistry compatibility

### Production Checkout (without tests)

Use `git archive` to export DOMule without test files and development dependencies:

```bash
git archive --format=zip HEAD -o domule-production.zip
```

The `.gitattributes` file excludes `__tests__/`, `node_modules/`, `package.json`, and other development files from the archive.

---

## So, why is it called "DOMule"?

Great question.

DOM + Module + Mule.

- The DOM declares what's needed;
- Modules provide it;
- The mule hauls it — but only what's actually required. Like the animal, it's stubborn about not carrying dead weight.

---

## Notes

This is a personal repository for maintaining the module system. Feel free to use it, but note: modules may change
without prior notice.

**Version:** 3.1.0  
**License:** MIT  
**Author:** Klaas Leussink / hnldesign
