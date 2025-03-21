import format from "./attestation-info.json";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import * as base64 from "base64-arraybuffer";

export function arrayBufferToHex (arrayBuffer,fmt = false) {
    if (typeof arrayBuffer !== 'object' || arrayBuffer === null || typeof arrayBuffer.byteLength !== 'number') {
      throw new TypeError('Expected input to be an ArrayBuffer')
    }
  
    var view = new Uint8Array(arrayBuffer)
    var result = ''
    var value
  
    for (var i = 0; i < view.length; i++) {
      value = view[i].toString(16)
      result += (value.length === 1 ? '0' + value : value)
      if (fmt){
        if (i < (view.length-1)){
          result += ":"
        }
      }
    }
    return result
}
  
export function hex_decode(string) {
    let bytes = [];
    string.replace(/../g, function (pair) {
        bytes.push(parseInt(pair, 16));
    });
    return new Uint8Array(bytes).buffer;
}

/*
Convert an ArrayBuffer into a string
from https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string/
*/
export function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}
  
export function zeroPad(num, places){
    return String(num).padStart(places, '0');
}

export function checkAttestationInfoFormat(attestationInfo) {
    if (!attestationInfo) return false;
    try {
        return Object.entries(format)
            .filter(([, val]) => val === "required")
            .every(([key,]) => attestationInfo.hasOwnProperty(key));
    } catch (e) {
        console.log(e);
        return false;
    }
}

/**
 * Checks if since date1 one or multiple date changes have happened.
 * @example date1: 2023-05-22T23:30Z; date2: 2023-05-23T00:00Z would return true
 * @example date1: 2023-05-22T23:30Z; date2: 2023-05-22T23:35Z would return false
 * @param {Date} date1
 * @param {Date} date2
 * @return {boolean} returns true if since date1 the date (ignoring time) has changed.
 */
export function hasDateChanged(date1, date2) {
    // reset the time to zero for both dates, thus we can only compare date, month and year
    const date1Zeroed = new Date(date1.toISOString().split('T')[0]);
    const date2Zeroed = new Date(date2.toISOString().split('T')[0]);
    return date2Zeroed > date1Zeroed;
}

export function base64ToArrayBuffer(str) {
    return base64.decode(str);
}

// TODO: refactor
export function pemToArrayBuffer(pem) { // TODO: rework, use own util function
    const base64String = pem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s+/g, ""); // Remove newlines and spaces

    const binaryString = atob(base64String); // TODO: rework, is deprecated
    const len = binaryString.length;
    const buffer = new ArrayBuffer(len);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < len; i++) {
        view[i] = binaryString.charCodeAt(i);
    }

    return buffer;

    // return base64ToArrayBuffer(base64String);
}

// https://developer.chrome.com/blog/how-to-convert-arraybuffer-to-and-from-string
export function stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    const bufView = new Uint16Array(buf);
    let i = 0, strLen = str.length;
    for (; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

// TODO: refactor
export function base64StrToCert(base64Str) {
    // reformat certificate into multi line string; remove all \r characters
    const certStr = base64Str.replace(/\\n/g, '\n').replace(/\r/g, "");
    const ab = pemToArrayBuffer(certStr);
    const asn1 = asn1js.fromBER(ab);
    if (asn1.offset === -1)
        throw new Error("Incorrect encoded ASN.1 data");

    return new pkijs.Certificate({schema: asn1.result});
}

export async function sha512(str) {
    return crypto.subtle.digest("SHA-512", new TextEncoder("utf-8").encode(str)).then(buf => {
        return Array.prototype.map.call(new Uint8Array(buf), x => (('00' + x.toString(16)).slice(-2))).join('');
    });
    // const encoder = new TextEncoder();
    // const data = encoder.encode(str);
    // const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    // const hashArray = Array.from(new Uint8Array(hashBuffer));
    // const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // return hashHex;
}

export function generateNonce() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let nonce = '';
    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        nonce += characters[randomIndex];
    }
    return nonce;
}
