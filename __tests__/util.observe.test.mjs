/**
 * @fileoverview Tests for util.observe.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isVisible, isVisibleNow, isResizedNow, isUnobstructed, getBlockerHeight, NAME } from '../util.observe.mjs';

describe('util.observe', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        // Set up viewport dimensions
        Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
        Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('observe');
        });
    });

    describe('isVisible', () => {
        it('detects element in viewport', () => {
            const element = document.createElement('div');
            element.style.width = '100px';
            element.style.height = '100px';
            document.body.appendChild(element);

            // Mock getBoundingClientRect to return in-viewport position
            element.getBoundingClientRect = () => ({
                top: 100,
                bottom: 200,
                left: 100,
                right: 200,
                width: 100,
                height: 100
            });

            let visible, fullyVisible;
            isVisible(element, (v, fv) => {
                visible = v;
                fullyVisible = fv;
            });

            expect(visible).toBe(true);
            expect(fullyVisible).toBe(true);
        });

        it('detects element fully outside viewport', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            // Element is below viewport
            element.getBoundingClientRect = () => ({
                top: 1000,
                bottom: 1100,
                left: 100,
                right: 200,
                width: 100,
                height: 100
            });

            let visible;
            isVisible(element, (v) => { visible = v; });

            expect(visible).toBe(false);
        });

        it('detects partially visible element', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            // Element partially in viewport (bottom half visible)
            element.getBoundingClientRect = () => ({
                top: -50,
                bottom: 50,
                left: 100,
                right: 200,
                width: 100,
                height: 100
            });

            let visible, fullyVisible;
            isVisible(element, (v, fv) => {
                visible = v;
                fullyVisible = fv;
            });

            expect(visible).toBe(true);
            expect(fullyVisible).toBe(false);
        });

        it('respects custom viewport boundaries', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            // Element positioned at top:200, bottom:300
            element.getBoundingClientRect = () => ({
                top: 200,
                bottom: 300,
                left: 100,
                right: 200,
                width: 100,
                height: 100
            });

            // With viewport bottom at 768, element is visible
            let visible, fullyVisible;
            isVisible(element, (v, fv) => { visible = v; fullyVisible = fv; }, { top: 100, bottom: 768 });

            expect(visible).toBe(true);
            // Element is fully visible because 200 > 100 (top) and 300 < 768 (bottom)
            expect(fullyVisible).toBe(true);

            // Element below viewport: top:200 > viewport.bottom:100, not visible
            element.getBoundingClientRect = () => ({
                top: 200,
                bottom: 300,
                left: 100,
                right: 200,
                width: 100,
                height: 100
            });

            isVisible(element, (v) => { visible = v; }, { top: 0, bottom: 100 });

            // Element starts at 200 which is > viewport bottom of 100, so not visible
            expect(visible).toBe(false);
        });

        it('throws TypeError for non-element', () => {
            expect(() => isVisible('string', () => {}))
                .toThrow(TypeError);
            expect(() => isVisible(null, () => {}))
                .toThrow(TypeError);
        });

        it('detects zero-dimension elements as not visible', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            element.getBoundingClientRect = () => ({
                top: 100,
                bottom: 100,
                left: 100,
                right: 100,
                width: 0,
                height: 0
            });

            let visible;
            isVisible(element, (v) => { visible = v; });

            expect(visible).toBe(false);
        });

        it('provides pageX and pageY in rect', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            element.getBoundingClientRect = () => ({
                top: 100,
                bottom: 200,
                left: 50,
                right: 150,
                width: 100,
                height: 100
            });

            let rect;
            isVisible(element, (v, fv, r) => { rect = r; });

            expect(rect.pageY).toBeDefined();
            expect(rect.pageX).toBeDefined();
        });
    });

    describe('isVisibleNow', () => {
        it('returns IntersectionObserver instance', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const observer = isVisibleNow(element, () => {});

            expect(observer).toBeInstanceOf(IntersectionObserver);

            observer.disconnect();
        });

        it('throws TypeError for non-element', () => {
            expect(() => isVisibleNow('string', () => {}))
                .toThrow(TypeError);
            expect(() => isVisibleNow(null, () => {}))
                .toThrow(TypeError);
        });

        it('accepts rootMargin option', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const observer = isVisibleNow(element, () => {}, { rootMargin: '50px' });

            expect(observer).toBeInstanceOf(IntersectionObserver);

            observer.disconnect();
        });

        it('accepts threshold option', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const observer = isVisibleNow(element, () => {}, { threshold: [0, 0.5, 1] });

            expect(observer).toBeInstanceOf(IntersectionObserver);

            observer.disconnect();
        });

        it('observer can be disconnected', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const observer = isVisibleNow(element, () => {});

            expect(() => observer.disconnect()).not.toThrow();
        });
    });

    describe('isResizedNow', () => {
        it('returns cleanup function', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const cleanup = isResizedNow(element, () => {});

            expect(typeof cleanup).toBe('function');

            cleanup();
        });

        it('cleanup function does not throw', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const cleanup = isResizedNow(element, () => {});

            expect(() => cleanup()).not.toThrow();
        });
    });

    describe('isUnobstructed', () => {
        it('returns true for unobstructed element', () => {
            const element = document.createElement('div');
            element.style.width = '100px';
            element.style.height = '100px';
            element.style.position = 'absolute';
            element.style.top = '100px';
            element.style.left = '100px';
            document.body.appendChild(element);

            // Mock elementFromPoint to return the element itself
            const originalElementFromPoint = document.elementFromPoint;
            document.elementFromPoint = (x, y) => element;

            try {
                const result = isUnobstructed(element);
                expect(result).toBe(true);
            } finally {
                document.elementFromPoint = originalElementFromPoint;
            }
        });

        it('returns true when child element is hit', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            parent.appendChild(child);
            document.body.appendChild(parent);

            parent.getBoundingClientRect = () => ({
                top: 100, bottom: 200, left: 100, right: 200
            });

            const originalElementFromPoint = document.elementFromPoint;
            document.elementFromPoint = () => child;

            try {
                const result = isUnobstructed(parent);
                expect(result).toBe(true);
            } finally {
                document.elementFromPoint = originalElementFromPoint;
            }
        });

        it('returns true when parent element is hit', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            parent.appendChild(child);
            document.body.appendChild(parent);

            child.getBoundingClientRect = () => ({
                top: 100, bottom: 200, left: 100, right: 200
            });

            const originalElementFromPoint = document.elementFromPoint;
            document.elementFromPoint = () => parent;

            try {
                const result = isUnobstructed(child);
                expect(result).toBe(true);
            } finally {
                document.elementFromPoint = originalElementFromPoint;
            }
        });

        it('returns false when completely obstructed', () => {
            const element = document.createElement('div');
            const blocker = document.createElement('div');
            document.body.appendChild(element);
            document.body.appendChild(blocker);

            element.getBoundingClientRect = () => ({
                top: 100, bottom: 200, left: 100, right: 200
            });

            const originalElementFromPoint = document.elementFromPoint;
            document.elementFromPoint = () => blocker;

            try {
                const result = isUnobstructed(element);
                expect(result).toBe(false);
            } finally {
                document.elementFromPoint = originalElementFromPoint;
            }
        });

        it('returns true if any sample point is unobstructed', () => {
            const element = document.createElement('div');
            const blocker = document.createElement('div');
            document.body.appendChild(element);
            document.body.appendChild(blocker);

            element.getBoundingClientRect = () => ({
                top: 100, bottom: 200, left: 100, right: 200
            });

            // Return element only for center point
            const originalElementFromPoint = document.elementFromPoint;
            document.elementFromPoint = (x, y) => {
                if (x === 150 && y === 150) return element;
                return blocker;
            };

            try {
                const result = isUnobstructed(element);
                expect(result).toBe(true);
            } finally {
                document.elementFromPoint = originalElementFromPoint;
            }
        });
    });

    describe('getBlockerHeight', () => {
        it('returns 0 when no blockers', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            // No elements blocking
            const originalElementsFromPoint = document.elementsFromPoint;
            document.elementsFromPoint = () => [];

            try {
                const height = getBlockerHeight(element, 512);
                expect(height).toBe(0);
            } finally {
                document.elementsFromPoint = originalElementsFromPoint;
            }
        });

        it('returns blocker height', () => {
            const element = document.createElement('div');
            const header = document.createElement('header');
            document.body.appendChild(element);
            document.body.appendChild(header);

            header.getBoundingClientRect = () => ({ bottom: 80 });

            const originalElementsFromPoint = document.elementsFromPoint;
            let callCount = 0;
            document.elementsFromPoint = () => {
                callCount++;
                // First call returns header, subsequent calls return empty
                if (callCount === 1) return [header];
                return [];
            };

            try {
                const height = getBlockerHeight(element, 512);
                expect(height).toBe(80);
            } finally {
                document.elementsFromPoint = originalElementsFromPoint;
            }
        });

        it('accumulates stacked blockers', () => {
            const element = document.createElement('div');
            const header = document.createElement('header');
            const navbar = document.createElement('nav');
            document.body.appendChild(element);
            document.body.appendChild(header);
            document.body.appendChild(navbar);

            header.getBoundingClientRect = () => ({ bottom: 50 });
            navbar.getBoundingClientRect = () => ({ bottom: 100 });

            const originalElementsFromPoint = document.elementsFromPoint;
            let callCount = 0;
            document.elementsFromPoint = (x, y) => {
                callCount++;
                if (y <= 1) return [header];
                if (y <= 51) return [navbar];
                return [];
            };

            try {
                const height = getBlockerHeight(element, 512);
                expect(height).toBe(100);
            } finally {
                document.elementsFromPoint = originalElementsFromPoint;
            }
        });

        it('excludes target element from blockers', () => {
            const element = document.createElement('div');
            document.body.appendChild(element);

            const originalElementsFromPoint = document.elementsFromPoint;
            document.elementsFromPoint = () => [element];

            try {
                const height = getBlockerHeight(element, 512);
                expect(height).toBe(0);
            } finally {
                document.elementsFromPoint = originalElementsFromPoint;
            }
        });
    });
});
