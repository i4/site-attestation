import {AttestationReport} from "../lib/attestation";
import {base64ToArrayBuffer, stringToArrayBuffer} from "../lib/util";
import * as pkijs from "pkijs";
import * as asn1js from "asn1js";

function pemToArrayBuffer(pem) { // TODO: rework, use own util function
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

export class HostAttestationInfo {
    constructor(data) {
        const json = JSON.parse(data);
        this.report = json.report;
        this.vcek = json.vcek;
    }

    get attestationReport() {
        return new AttestationReport(base64ToArrayBuffer(this.report));
    }

    get reportDataStr() {
        const decoder = new TextDecoder();
        return decoder.decode(this.attestationReport.report_data);
    }

    get vcekCert() {
        // reformat certificate into multi line string
        const vcekStr = this.vcek.replace(/\\n/g, '\n');
        const ab = pemToArrayBuffer(vcekStr);
        const asn1 = asn1js.fromBER(ab);
        if (asn1.offset === -1)
            throw new Error("Incorrect encoded ASN.1 data");

        return new pkijs.Certificate({schema: asn1.result});
    }
}
