/**
 * @fileoverview Tests for util.dom.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForComplexNode, parseHTML, writeCSS, getScriptPath, NAME } from '../util.dom.mjs';

describe('util.dom', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('dom');
        });
    });

    describe('parseHTML', () => {
        it('parses single element', () => {
            const result = parseHTML('<div class="test">Content</div>');

            expect(result).toBeInstanceOf(HTMLDivElement);
            expect(result.className).toBe('test');
            expect(result.textContent).toBe('Content');
        });

        it('parses multiple elements and returns HTMLCollection', () => {
            const result = parseHTML('<div>First</div><span>Second</span>');

            expect(result).toBeInstanceOf(HTMLCollection);
            expect(result).toHaveLength(2);
            expect(result[0].tagName).toBe('DIV');
            expect(result[1].tagName).toBe('SPAN');
        });

        it('parses nested elements', () => {
            const result = parseHTML(`
                <article class="card">
                    <h2>Title</h2>
                    <p>Description</p>
                </article>
            `);

            expect(result.tagName).toBe('ARTICLE');
            expect(result.querySelector('h2').textContent).toBe('Title');
            expect(result.querySelector('p').textContent).toBe('Description');
        });

        it('trims whitespace from input', () => {
            const result = parseHTML('   <div>Content</div>   ');

            expect(result).toBeInstanceOf(HTMLDivElement);
        });

        it('throws TypeError for non-string input', () => {
            expect(() => parseHTML(null)).toThrow(TypeError);
            expect(() => parseHTML(123)).toThrow(TypeError);
            expect(() => parseHTML({})).toThrow(TypeError);
        });

        it('handles empty string gracefully', () => {
            const result = parseHTML('');

            // Empty template returns empty HTMLCollection
            expect(result).toBeInstanceOf(HTMLCollection);
            expect(result).toHaveLength(0);
        });

        it('does not execute scripts', () => {
            // Template content is inert - scripts should not execute
            const scriptExecuted = { value: false };
            window.testScriptExecution = () => { scriptExecuted.value = true; };

            parseHTML('<script>window.testScriptExecution()</script>');

            expect(scriptExecuted.value).toBe(false);

            delete window.testScriptExecution;
        });
    });

    describe('writeCSS', () => {
        it('creates and appends link element to head', () => {
            const link = writeCSS('/assets/css/test.css');

            expect(link).toBeInstanceOf(HTMLLinkElement);
            expect(link.rel).toBe('stylesheet');
            expect(link.type).toBe('text/css');
            expect(link.href).toContain('/assets/css/test.css');
            expect(document.head.contains(link)).toBe(true);
        });

        it('throws error for empty src', () => {
            expect(() => writeCSS('')).toThrow(/non-empty string/);
            expect(() => writeCSS(null)).toThrow();
            expect(() => writeCSS()).toThrow();
        });

        it('returns link element for load tracking', () => {
            const link = writeCSS('/test.css');

            // Should be able to attach listeners
            expect(typeof link.addEventListener).toBe('function');
        });

        it('handles relative paths', () => {
            const link = writeCSS('./styles/module.css');

            expect(link.href).toContain('styles/module.css');
        });
    });

    describe('waitForComplexNode', () => {
        it('calls callback immediately if node exists', () => {
            const div = document.createElement('div');
            div.id = 'target';
            document.body.appendChild(div);

            const callback = vi.fn();

            waitForComplexNode(
                () => document.getElementById('target'),
                callback
            );

            expect(callback).toHaveBeenCalledWith(div);
        });

        it('waits for node to appear', async () => {
            vi.useFakeTimers();

            const callback = vi.fn();

            waitForComplexNode(
                () => document.getElementById('delayed'),
                callback,
                5000,
                100
            );

            expect(callback).not.toHaveBeenCalled();

            // Add element after 150ms
            vi.advanceTimersByTime(100);
            expect(callback).not.toHaveBeenCalled();

            const div = document.createElement('div');
            div.id = 'delayed';
            document.body.appendChild(div);

            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalledWith(div);

            vi.useRealTimers();
        });

        it('times out after specified duration', async () => {
            vi.useFakeTimers();

            const callback = vi.fn();
            const warnSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

            waitForComplexNode(
                () => document.getElementById('never-exists'),
                callback,
                1000,
                100
            );

            vi.advanceTimersByTime(1100);

            expect(callback).not.toHaveBeenCalled();

            warnSpy.mockRestore();
            vi.useRealTimers();
        });

        it('returns cleanup function that cancels waiting', () => {
            vi.useFakeTimers();

            const callback = vi.fn();

            const cleanup = waitForComplexNode(
                () => document.getElementById('target'),
                callback,
                5000,
                100
            );

            // Cancel immediately
            cleanup();

            // Add element after cancellation
            const div = document.createElement('div');
            div.id = 'target';
            document.body.appendChild(div);

            vi.advanceTimersByTime(200);

            // Callback should not be called since we cancelled
            expect(callback).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('throws TypeError for invalid getNode', () => {
            expect(() => waitForComplexNode('string', () => {}))
                .toThrow(TypeError);
            expect(() => waitForComplexNode(null, () => {}))
                .toThrow(TypeError);
        });

        it('throws TypeError for invalid callback', () => {
            expect(() => waitForComplexNode(() => null, 'string'))
                .toThrow(TypeError);
            expect(() => waitForComplexNode(() => null, null))
                .toThrow(TypeError);
        });

        it('handles errors in getNode gracefully', () => {
            vi.useFakeTimers();

            const callback = vi.fn();
            let shouldThrow = true;

            waitForComplexNode(
                () => {
                    if (shouldThrow) {
                        throw new Error('Shadow DOM not ready');
                    }
                    return document.createElement('div');
                },
                callback,
                5000,
                100
            );

            vi.advanceTimersByTime(100);
            expect(callback).not.toHaveBeenCalled();

            // Stop throwing
            shouldThrow = false;

            vi.advanceTimersByTime(100);
            expect(callback).toHaveBeenCalled();

            vi.useRealTimers();
        });
    });

    describe('getScriptPath', () => {
        it('returns a string path', () => {
            const path = getScriptPath();

            expect(typeof path).toBe('string');
            expect(path.length).toBeGreaterThan(0);
        });

        it('returns path without filename', () => {
            const path = getScriptPath();

            // Should not end with .mjs
            expect(path.endsWith('.mjs')).toBe(false);
        });
    });
});
