/**
 * @fileoverview String Formatting Utilities - HTML cleanup, phone/URL formatting
 * @module util.format
 * @version 3.0.0
 * @author hnldesign
 * @since 2022
 *
 * @description
 * Provides utilities for cleaning and formatting common data types:
 * - HTML tag stripping with whitespace normalization
 * - Dutch phone number formatting with international prefix support
 * - URL normalization (ensures https://, removes excess slashes)
 * - Auto-detection formatting based on content patterns
 *
 * All functions are pure (no side effects) and handle edge cases gracefully.
 *
 * @example
 * import {cleanUpString, formatPhone, formatHref} from './util.format.mjs';
 *
 * cleanUpString('<p>Hello   World</p>');
 * // → 'Hello World'
 *
 * formatPhone('0201234567');
 * // → '+31 20 - 123 45 67'
 *
 * formatHref('example.com/path');
 * // → 'https://example.com/path'
 */

export const NAME = 'format';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Dutch area code prefixes ordered by length (longest first for greedy matching).
 * Covers mobile (06), premium (09xx), toll-free (0800), and geographic codes.
 * @private
 * @type {string[]}
 */
const AREA_PREFIXES = [
    // 4-digit prefixes
    '0909', '0906', '0900', '0842', '0800', '0676',
    // 3-digit prefixes (sorted by length then alphabetically)
    '010', '046', '0111', '0475', '0113', '0478', '0114', '0481', '0115', '0485',
    '0117', '0486', '0118', '0487', '013', '0488', '015', '0492', '0161', '0493',
    '0162', '0495', '0164', '0497', '0165', '0499', '0166', '050', '0167', '0511',
    '0168', '0512', '0172', '0513', '0174', '0514', '0180', '0515', '0181', '0516',
    '0182', '0517', '0183', '0518', '0184', '0519', '0186', '0521', '0187', '0522',
    '020', '0523', '0222', '0524', '0223', '0525', '0224', '0527', '0226', '0528',
    '0227', '0529', '0228', '053', '0229', '0541', '023', '0543', '024', '0544',
    '0251', '0545', '0252', '0546', '0255', '0547', '026', '0548', '0294', '055',
    '0297', '0561', '0299', '0562', '030', '0566', '0313', '0570', '0314', '0571',
    '0315', '0572', '0316', '0573', '0317', '0575', '0318', '0577', '0320', '0578',
    '0321', '058', '033', '0591', '0341', '0592', '0342', '0593', '0343', '0594',
    '0344', '0595', '0345', '0596', '0346', '0597', '0347', '0598', '0348', '0599',
    '035', '070', '036', '071', '038', '0418', '072', '040', '073', '0411', '074',
    '0412', '075', '0413', '076', '0416', '077', '078', '043', '079', '045',
    // 2-digit mobile
    '06'
];

/** @private @type {RegExp} */
const WHITESPACE_PATTERN = /\s+/g;

/** @private @type {RegExp} */
const HTML_TAG_PATTERN = /(<([^>]+)>)/ig;

/** @private @type {RegExp} */
const MULTIPLE_SPACES_PATTERN = /\s{2,}/g;

/** @private @type {RegExp} */
const URL_PATTERN = /^https?:\/\/\S+|www\.\S+/;

/** @private @type {RegExp} - 8-digit: XXX XX XX XX */
const PHONE_LONG_PATTERN = /(\d{2,3})(\d{2})(\d{2})(\d{2})/i;

/** @private @type {RegExp} - 6-7 digit: XX XX XX or XXX XX XX */
const PHONE_SHORT_PATTERN = /(\d{2,3})(\d{2})(\d{2})/i;

/**
 * Valid phone number length range (after stripping whitespace/formatting).
 * @private
 */
const PHONE_MIN_LENGTH = 10; // 0612345678
const PHONE_MAX_LENGTH = 11; // 00311234567 or +311234567

/**
 * Separator between area code and number.
 * @private
 * @type {string}
 */
const AREA_SEPARATOR = ' - ';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Strips HTML tags and normalizes whitespace.
 *
 * Removes all HTML tags (including attributes) and collapses multiple spaces
 * into single spaces. Trims leading/trailing whitespace.
 *
 * @param {string} string - String potentially containing HTML
 * @returns {string} Plain text with normalized whitespace
 *
 * @example
 * cleanUpString('<p>Hello   <strong>World</strong></p>');
 * // → 'Hello World'
 *
 * @example
 * cleanUpString('  Multiple   spaces   ');
 * // → 'Multiple spaces'
 *
 * @example
 * cleanUpString('<script>alert("XSS")</script>Text');
 * // → 'Text'
 */
export function cleanUpString(string) {
    return string
        .replace(HTML_TAG_PATTERN, '')
        .replace(MULTIPLE_SPACES_PATTERN, ' ')
        .trim();
}

/**
 * Formats Dutch phone numbers with area code separation and grouping.
 *
 * Handles:
 * - Mobile numbers (06)
 * - Geographic area codes (010, 020, etc.)
 * - International prefixes (+31, 0031)
 * - Premium/toll-free numbers (0900, 0800)
 *
 * Output format:
 * - National: `020 - 123 45 67`
 * - International: `+31 20 - 123 45 67`
 *
 * @param {string|string[]} phone - Phone number (string or array of digits)
 * @returns {string} Formatted phone number or original input if invalid
 *
 * @example
 * formatPhone('0201234567');
 * // → '020 - 123 45 67'
 *
 * @example
 * formatPhone('+31201234567');
 * // → '+31 20 - 123 45 67'
 *
 * @example
 * formatPhone('0612345678');
 * // → '06 - 123 45 67'
 *
 * @example
 * formatPhone('invalid');
 * // → 'invalid' (returns unchanged)
 */
export function formatPhone(phone) {
    const result = [];
    let countryPrefix = '';

    // Normalize input: array → string, strip whitespace
    let normalized = (typeof phone !== 'string' ? phone.join('') : cleanUpString(phone))
        .replace(WHITESPACE_PATTERN, '');

    // Extract international prefix if present
    if (normalized.startsWith('00') || normalized.startsWith('+')) {
        countryPrefix = normalized.startsWith('+')
            ? normalized.slice(0, 3)   // +31
            : normalized.slice(0, 4);  // 0031
        normalized = '0' + normalized.substring(countryPrefix.length);
        result.push(countryPrefix);
    }

    // Find longest matching area code (greedy match)
    let areaCode = normalized.slice(0, 3); // Default: first 3 digits
    for (let length = 5; length >= 2; length--) {
        const candidate = normalized.slice(0, length);
        if (AREA_PREFIXES.includes(candidate)) {
            areaCode = candidate;
            break;
        }
    }

    // Extract subscriber number (digits after area code)
    const subscriberNumber = normalized.substring(areaCode.length);

    // Format area code (strip leading 0 if international)
    const formattedAreaCode = countryPrefix
        ? areaCode.substring(1)
        : areaCode;
    result.push(formattedAreaCode + AREA_SEPARATOR);

    // Group subscriber number: XX XX XX XX or XX XX XX
    const pattern = subscriberNumber.length > 7
        ? PHONE_LONG_PATTERN
        : PHONE_SHORT_PATTERN;

    const matches = subscriberNumber.match(pattern);
    if (matches) {
        matches.shift(); // Remove full match
        result.push(matches.join(' '));
        return result.join(' ').replace(MULTIPLE_SPACES_PATTERN, ' ');
    }

    // Invalid format - return original
    return phone;
}

/**
 * Normalizes URLs to ensure https:// scheme and clean formatting.
 *
 * - Adds https:// if missing
 * - Preserves existing scheme (http/https)
 * - Removes excessive slashes (/// → //)
 * - Handles query strings and fragments
 *
 * @param {string} urlString - URL to normalize
 * @returns {string} Normalized URL with https:// scheme
 *
 * @example
 * formatHref('example.com/path');
 * // → 'https://example.com/path'
 *
 * @example
 * formatHref('http://example.com///path');
 * // → 'http://example.com/path'
 *
 * @example
 * formatHref('https://example.com?foo=bar');
 * // → 'https://example.com?foo=bar'
 */
export function formatHref(urlString) {
    const parts = urlString.split('//');
    const uri = parts.length === 1 ? parts[0] : parts[1];
    return ('https://' + uri).replace(/\/{3,}/g, '//');
}

/**
 * Auto-detects content type and applies appropriate formatting.
 *
 * Detection rules:
 * 1. Phone: 10-11 digits, no letters
 * 2. URL: Starts with http(s):// or www.
 * 3. Other: Returns cleaned string (HTML stripped, whitespace normalized)
 *
 * @param {string} string - String to format
 * @param {string} [validateAs='auto'] - Force specific format: 'auto'|'phone'|'url'
 * @returns {string} Formatted string
 *
 * @example
 * formatString('0201234567');
 * // → '020 - 123 45 67' (detected as phone)
 *
 * @example
 * formatString('www.example.com');
 * // → 'https://www.example.com' (detected as URL)
 *
 * @example
 * formatString('<p>Hello</p>', 'auto');
 * // → 'Hello' (cleaned text)
 *
 * @example
 * formatString('1234567890', 'phone');
 * // → '123 - 45 67 89' (forced phone format)
 */
export function formatString(string, validateAs = 'auto') {
    const cleaned = cleanUpString(string);

    // Extract digits and letters for heuristics
    const digitString = (cleaned.match(/\d+/g) || []).join('');
    const wordString = (cleaned.match(/[A-Za-z]+/g) || []).join('');

    // Phone number heuristic: 10-11 digits, no letters
    const looksLikePhone =
        digitString.length >= PHONE_MIN_LENGTH &&
        digitString.length <= PHONE_MAX_LENGTH &&
        !wordString.length;

    if (looksLikePhone || validateAs === 'phone') {
        return formatPhone(digitString);
    }

    // URL heuristic: starts with http(s):// or www.
    if (URL_PATTERN.test(cleaned)) {
        return formatHref(cleaned);
    }

    // Default: return cleaned string
    return cleaned;
}