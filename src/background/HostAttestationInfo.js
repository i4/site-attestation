import {AttestationReport} from "../lib/attestation";
import {base64ToArrayBuffer, stringToArrayBuffer} from "../lib/util";
import asn1js from "asn1js";
import pkijs from "pkijs";

function pemToArrayBuffer(pem) {
    const base64String = pem
        .replace("-----BEGIN CERTIFICATE-----", "")
        .replace("-----END CERTIFICATE-----", "")
        .replace(/\s+/g, ""); // Remove newlines and spaces

    const binaryString = atob(base64String);
    const len = binaryString.length;
    const buffer = new ArrayBuffer(len);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < len; i++) {
        view[i] = binaryString.charCodeAt(i);
    }

    return buffer;
}

export class HostAttestationInfo {
    constructor(data) {
        const json = JSON.parse(data);
        this.report = json.report;
        this.vcek = json.vcek;

        this.attestationReport = new AttestationReport(base64ToArrayBuffer(this.report));
    }

    get reportDataStr() {
        const decoder = new TextDecoder();
        return decoder.decode(this.attestationReport.report_data);
    }

    get vcekCert() {
        const vcekStr = this.vcek.replace(/\\n/g, '\n');
        console.log("vcekStr" + vcekStr);


        // const ab = stringToArrayBuffer(vcekStr);
        const ab = pemToArrayBuffer(vcekStr);

        console.log("StrToArBuf succ")

        // TODO: fails
        const asn1 = asn1js.fromBER(ab);

        console.log("asn1 succ");

        if (asn1.offset === -1)
            throw new Error("Incorrect encoded ASN.1 data");

        console.log("creting Cert")

        return new pkijs.Certificate({schema: asn1.result});
    }
}
