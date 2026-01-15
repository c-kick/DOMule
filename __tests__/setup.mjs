/**
 * @fileoverview Global test setup for Vitest
 * Configures jsdom environment and provides common mocks
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// EARLY GLOBAL MOCKS (before any module imports)
// ============================================================================

// Mock matchMedia immediately - needed by hnl.breakpoints.mjs
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// ============================================================================
// SUPPRESS EXPECTED UNHANDLED REJECTIONS IN TESTS
// ============================================================================

// Some tests intentionally create rejected promises (e.g., timeout tests)
// This handler prevents Vitest from treating them as errors
process.on('unhandledRejection', (reason) => {
    // Only suppress expected test errors
    if (reason?.message?.includes('Timeout waiting for module') ||
        reason?.message?.includes('no api() interface')) {
        // Expected test rejection, ignore
        return;
    }
    // Re-throw unexpected rejections
    throw reason;
});

// ============================================================================
// BROWSER API MOCKS
// ============================================================================

/**
 * Mock IntersectionObserver
 * jsdom doesn't implement this, so we need to mock it
 */
class MockIntersectionObserver {
    constructor(callback, options = {}) {
        this.callback = callback;
        this.options = options;
        this.elements = new Set();
    }

    observe(element) {
        this.elements.add(element);
    }

    unobserve(element) {
        this.elements.delete(element);
    }

    disconnect() {
        this.elements.clear();
    }

    // Helper to simulate intersection
    _trigger(entries) {
        this.callback(entries, this);
    }
}

/**
 * Mock ResizeObserver
 * jsdom doesn't implement this either
 */
class MockResizeObserver {
    constructor(callback) {
        this.callback = callback;
        this.elements = new Set();
    }

    observe(element) {
        this.elements.add(element);
    }

    unobserve(element) {
        this.elements.delete(element);
    }

    disconnect() {
        this.elements.clear();
    }

    _trigger(entries) {
        this.callback(entries, this);
    }
}

/**
 * Mock MutationObserver enhancements
 * jsdom has MutationObserver but we may need to track calls
 */
const originalMutationObserver = global.MutationObserver;

/**
 * Mock matchMedia
 * jsdom doesn't implement this API
 */
function mockMatchMedia(query) {
    return {
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    };
}

// ============================================================================
// PERFORMANCE API MOCK
// ============================================================================

const mockPerformance = {
    now: () => Date.now(),
    getEntriesByType: () => [],
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn()
};

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
    // Install mocks
    global.IntersectionObserver = MockIntersectionObserver;
    global.ResizeObserver = MockResizeObserver;
    window.matchMedia = mockMatchMedia;

    // Ensure performance API exists
    if (!global.performance) {
        global.performance = mockPerformance;
    }

    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';

    // Clear any module state that might persist between tests
    vi.clearAllMocks();
});

afterEach(() => {
    // Restore original implementations if needed
    vi.restoreAllMocks();
});

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a DOM element with data-requires attribute
 * @param {string} modulePath - Module path for data-requires
 * @param {Object} options - Additional options
 * @returns {HTMLElement}
 */
export function createRequiringElement(modulePath, options = {}) {
    const el = document.createElement(options.tag || 'div');
    el.setAttribute('data-requires', modulePath);

    if (options.lazy) {
        el.setAttribute('data-require-lazy', options.lazy === true ? 'true' : options.lazy);
    }

    if (options.id) {
        el.id = options.id;
    }

    if (options.className) {
        el.className = options.className;
    }

    if (options.appendTo !== false) {
        (options.appendTo || document.body).appendChild(el);
    }

    return el;
}

/**
 * Wait for next tick (microtask queue to flush)
 * @returns {Promise<void>}
 */
export function nextTick() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Wait for requestAnimationFrame
 * @returns {Promise<void>}
 */
export function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * Create a mock module for testing
 * @param {string} name - Module name
 * @param {Object} overrides - Override default exports
 * @returns {Object}
 */
export function createMockModule(name, overrides = {}) {
    return {
        NAME: name,
        init: vi.fn(() => `${name} initialized`),
        api: vi.fn((action) => `${name}.api(${action})`),
        ...overrides
    };
}

// Export mocks for direct use in tests
export { MockIntersectionObserver, MockResizeObserver };
