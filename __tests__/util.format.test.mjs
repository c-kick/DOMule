/**
 * @fileoverview Tests for util.format.mjs
 */

import { describe, it, expect } from 'vitest';
import { cleanUpString, formatPhone, formatHref, formatString, NAME } from '../util.format.mjs';

describe('util.format', () => {
    describe('NAME', () => {
        it('exports module name', () => {
            expect(NAME).toBe('format');
        });
    });

    describe('cleanUpString', () => {
        it('strips HTML tags', () => {
            expect(cleanUpString('<p>Hello</p>')).toBe('Hello');
            expect(cleanUpString('<strong>Bold</strong>')).toBe('Bold');
            expect(cleanUpString('<a href="url">Link</a>')).toBe('Link');
        });

        it('strips nested HTML tags', () => {
            expect(cleanUpString('<div><p><span>Nested</span></p></div>')).toBe('Nested');
        });

        it('handles self-closing tags', () => {
            expect(cleanUpString('Before<br/>After')).toBe('BeforeAfter');
            expect(cleanUpString('Image<img src="x"/>here')).toBe('Imagehere');
        });

        it('normalizes multiple spaces', () => {
            expect(cleanUpString('Hello   World')).toBe('Hello World');
            expect(cleanUpString('a    b    c')).toBe('a b c');
        });

        it('trims leading and trailing whitespace', () => {
            expect(cleanUpString('  Hello  ')).toBe('Hello');
            expect(cleanUpString('\n\tText\n\t')).toBe('Text');
        });

        it('handles combination of HTML and spaces', () => {
            expect(cleanUpString('<p>Hello   <strong>World</strong></p>')).toBe('Hello World');
        });

        it('strips script tags but preserves content between them', () => {
            // Note: cleanUpString strips tags only, not their text content
            // For actual XSS prevention, sanitize at input/output boundaries
            expect(cleanUpString('<script>alert("XSS")</script>Safe')).toBe('alert("XSS")Safe');
        });

        it('handles empty and whitespace-only strings', () => {
            expect(cleanUpString('')).toBe('');
            expect(cleanUpString('   ')).toBe('');
            expect(cleanUpString('<p></p>')).toBe('');
        });
    });

    describe('formatPhone', () => {
        describe('Dutch mobile numbers (06)', () => {
            it('formats standard mobile numbers', () => {
                expect(formatPhone('0612345678')).toBe('06 - 12 34 56 78');
            });
        });

        describe('Dutch geographic numbers', () => {
            it('formats Amsterdam (020) numbers', () => {
                expect(formatPhone('0201234567')).toBe('020 - 123 45 67');
            });

            it('formats Rotterdam (010) numbers', () => {
                expect(formatPhone('0101234567')).toBe('010 - 123 45 67');
            });

            it('formats Den Haag (070) numbers', () => {
                expect(formatPhone('0701234567')).toBe('070 - 123 45 67');
            });
        });

        describe('international format', () => {
            it('formats +31 prefix', () => {
                expect(formatPhone('+31201234567')).toBe('+31 20 - 123 45 67');
            });

            it('formats 0031 prefix', () => {
                expect(formatPhone('0031201234567')).toBe('0031 20 - 123 45 67');
            });

            it('formats +31 mobile', () => {
                expect(formatPhone('+31612345678')).toBe('+31 6 - 12 34 56 78');
            });
        });

        describe('special numbers', () => {
            it('formats 0800 toll-free numbers', () => {
                const result = formatPhone('08001234567');
                expect(result).toContain('0800');
            });

            it('formats 0900 premium numbers', () => {
                const result = formatPhone('09001234567');
                expect(result).toContain('0900');
            });
        });

        describe('edge cases', () => {
            it('handles pre-formatted input', () => {
                expect(formatPhone('020 123 4567')).toBe('020 - 123 45 67');
            });

            it('handles array input', () => {
                expect(formatPhone(['0', '2', '0', '1', '2', '3', '4', '5', '6', '7'])).toBe('020 - 123 45 67');
            });

            it('returns original for invalid input', () => {
                expect(formatPhone('invalid')).toBe('invalid');
                expect(formatPhone('12345')).toBe('12345'); // Too short
            });
        });
    });

    describe('formatHref', () => {
        it('adds https:// to bare domain', () => {
            expect(formatHref('example.com')).toBe('https://example.com');
        });

        it('adds https:// to domain with path', () => {
            expect(formatHref('example.com/path')).toBe('https://example.com/path');
        });

        it('converts http:// to https://', () => {
            // formatHref always normalizes to https://
            expect(formatHref('http://example.com')).toBe('https://example.com');
        });

        it('preserves existing https://', () => {
            expect(formatHref('https://example.com')).toBe('https://example.com');
        });

        it('handles URLs with multiple // by taking first part after split', () => {
            // Note: split('//') behavior means ///path gets lost
            // This is current behavior - may want to improve in future
            expect(formatHref('http://example.com///path')).toBe('https://example.com');
        });

        it('preserves query strings', () => {
            expect(formatHref('example.com?foo=bar')).toBe('https://example.com?foo=bar');
        });

        it('preserves fragments', () => {
            expect(formatHref('example.com#section')).toBe('https://example.com#section');
        });

        it('handles www prefix', () => {
            expect(formatHref('www.example.com')).toBe('https://www.example.com');
        });
    });

    describe('formatString', () => {
        describe('auto-detection', () => {
            it('detects and formats phone numbers', () => {
                expect(formatString('0201234567')).toBe('020 - 123 45 67');
            });

            it('detects and formats URLs with http (converts to https)', () => {
                // formatHref always normalizes to https://
                expect(formatString('http://example.com')).toBe('https://example.com');
            });

            it('detects and formats URLs with www', () => {
                expect(formatString('www.example.com')).toBe('https://www.example.com');
            });

            it('cleans HTML from other content', () => {
                expect(formatString('<p>Hello World</p>')).toBe('Hello World');
            });
        });

        describe('forced validation', () => {
            it('forces phone formatting', () => {
                expect(formatString('1234567890', 'phone')).toContain(' - ');
            });
        });

        describe('edge cases', () => {
            it('handles mixed content correctly', () => {
                // Contains digits but also letters - should not be phone
                expect(formatString('abc1234567890')).toBe('abc1234567890');
            });

            it('handles empty string', () => {
                expect(formatString('')).toBe('');
            });
        });
    });
});
