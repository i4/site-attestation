import {AttestationReport} from "../lib/attestation";
import {base64ToArrayBuffer} from "../lib/util";
import {base64StrToCert} from "../lib/crypto";

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
        return base64StrToCert(this.vcek);
    }
}
