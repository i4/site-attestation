import {AttestationReport} from "../lib/attestation";
import {base64ToArrayBuffer, base64StrToCert, sha512} from "../lib/util";
import * as util from "../lib/util";

export class HostAttestationInfo {
    constructor(data, tlsCertString, nonce) {
        if (data === undefined)
            return;

        const json = JSON.parse(data);
        this.report = json.report;
        this.vcek = json.vcek;
        this.tlsCertString = tlsCertString;
        this.nonce = nonce;
    }

    toJson() {
        return JSON.stringify(this);
    }

    fromJson(jsonStr) {
        const json = JSON.parse(jsonStr);
        this.report = json.report;
        this.vcek = json.vcek;
        this.tlsCertString = json.tlsCertString;
        this.nonce = json.nonce;
        return this;
    }

    get attestationReport() {
        return new AttestationReport(base64ToArrayBuffer(this.report));
    }

    get reportDataStr() {
        const buffer = this.attestationReport.report_data;
        return Array.prototype.map.call(new Uint8Array(buffer), x => (('00' + x.toString(16)).slice(-2))).join('');
        // like sha512 in util.js
    }

    get vcekCert() {
        return base64StrToCert(this.vcek);
    }

    get tlsCert() {
        return base64StrToCert(this.tlsCertString);
    }

    async getPubKey() {
        const pubKey = await this.tlsCert.getPublicKey();

        // export and format crypto key
        const exported = await window.crypto.subtle.exportKey(
            "spki",
            pubKey
        );
        const exportedAsString = util.ab2str(exported);
        const exportedAsBase64 = window.btoa(exportedAsString);

        return `-----BEGIN PUBLIC KEY-----
${exportedAsBase64.substring(0, 64)}
${exportedAsBase64.substring(64, 64 * 2)}
${exportedAsBase64.substring(64 * 2, 64 * 3)}
${exportedAsBase64.substring(64 * 3, 64 * 4)}
${exportedAsBase64.substring(64 * 4, 64 * 5)}
${exportedAsBase64.substring(64 * 5, 64 * 6)}
${exportedAsBase64.substring(64 * 6, 64 * 6 + 8)}
-----END PUBLIC KEY-----\n`;
    }

    // returns the hash, that is exactly, what should be present in an attestation report's report_data field in
    // order to be trustworthy
    async getVerificationHash() {
        return sha512(`${this.nonce}\n${await this.getPubKey()}`);
    }
}
