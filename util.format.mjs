export const NAME = 'format';

/**
 * Strips HTML tags from string
 *
 * @param {string} string - The string to clean
 * @returns {string} - The cleaned string
 */
export function cleanUpString(string){
    return string.replace(/(<([^>]+)>)/ig, '').replace(/\s{2,}/g, ' ').trim(); //replaces 2+ spaces with 1
}

/**
 * Formats Dutch phone numbers
 *
 * @param {string} $phone - The string to format
 * @returns {string} - The formatted string
 */
export function formatPhone($phone) {
    let ret = [], countryPrefix, phone;
    const whiteSpace = /\s+/g;
    const areaPrefix = ['06','0909','0906','0900','0842','0800','0676','06','010','046','0111','0475','0113','0478','0114','0481','0115','0485','0117','0486','0118','0487','013','0488','015','0492','0161','0493','0162','0495','0164','0497','0165','0499','0166','050','0167','0511','0168','0512','0172','0513','0174','0514','0180','0515','0181','0516','0182','0517','0183','0518','0184','0519','0186','0521','0187','0522','020','0523','0222','0524','0223','0525','0224','0527','0226','0528','0227','0529','0228','053','0229','0541','023','0543','024','0544','0251','0545','0252','0546','0255','0547','026','0548','0294','055','0297','0561','0299','0562','030','0566','0313','0570','0314','0571','0315','0572','0316','0573','0317','0575','0318','0577','0320','0578','0321','058','033','0591','0341','0592','0342','0593','0343','0594','0344','0595','0345','0596','0346','0597','0347','0598','0348','0599','035','070','036','071','038','072','040','073','0411','074','0412','075','0413','076','0416','077','0418','078','043','079','045'];
    const areaPrefixSeparator = ' - '; //bijv ' - '  voor 030 - 123 45 67.

    phone = ((typeof $phone !== 'string') ? $phone.join('') : clean_string($phone)).replace(whiteSpace, '');

    if (phone.slice(0,2) === '00' || phone.slice(0,1) === '+') {
        countryPrefix = (phone.slice(0,1) === '+') ? phone.slice(0,3) : phone.slice(0,4);
        phone = '0' + phone.substring(countryPrefix.length);
        ret.push(countryPrefix);
    }

    let x = 5, kental = phone.slice(0, 3); //def eerste 3 cijfers.
    while(x--) {
        if (areaPrefix.includes(phone.slice(0,x))){
            kental = phone.slice(0, x);
            break;
        }
    }
    phone = phone.substring(kental.length);
    ret.push(kental.substr(countryPrefix ? 1 : 0) + areaPrefixSeparator);

    let regex = phone.length > 7 ? /(\d{2,3})(\d{2})(\d{2})(\d{2})/i : /(\d{2,3})(\d{2})(\d{2})/i
    let matches = phone.match(regex); //maakt groepjes: XXX XX XX bij 7 karakters of XX XX XX bij 6 of (andere regex) XX XX XX XX bij meer dan 7
    if (matches) {
        matches.shift();
        ret.push(matches.join(' '));
        return ret.join(' ').replace(/\s{2,}/g, ' ');
    } else {
        //do nothing
        return $phone;
    }
}

/**
 * Formats a string containing a URL.
 *
 * @param {string} urlString - The URL string to format.
 * @returns {string} - The formatted URL string.
 */
export function formatHref(urlString) {
    const https = 'https:';
    const parts = urlString.split('//');
    const uri = parts.length === 1 ? parts[0] : parts[1];
    return (https + '//' + uri).replace(/\/{3,}/g, '//');
}

/**
 * General string formatter, which implements methods above. Will auto format if no validateAs was passed
 *
 * @param {string} string - The string to format.
 * @param {string} [validateAs='auto'] - The type of formatting to apply (defaults to 'auto').
 * @returns {string} - The formatted string.
 */
export function formatString(string, validateAs = 'auto') {
    // Clean up the input string
    string = cleanUpString(string);

    // Extract digits and words from the string
    const digitString = (string.match(/\d+/g) || []).join('');
    const wordString = (string.match(/[A-Za-z]+/g) || []).join('');

    // Apply phone number formatting
    if ((digitString.length > 9 && digitString.length < 12 && !wordString.length) || validateAs === 'phone') {
        return formatPhone(digitString);
    } else if (/^https?:\/\/\S+|www\.\S+/.test(string)) {
        // Apply URL formatting
        return formatHref(string);
    } else {
        // No formatting needed
        return string;
    }
}
