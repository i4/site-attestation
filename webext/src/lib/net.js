import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import * as util from "./util";
import * as attestation from "./attestation";

export async function fetchArrayBuffer(url) {
    const response = await fetch(url, {
        method: "GET",
        cache: "no-cache",
        referrerPolicy: "no-referrer"
    });
    if (response.ok)
        return await response.arrayBuffer();
    else
        throw new Error("failed to fetch arraybuffer");
}

export async function fetchAttestationInfo(url) {
    // treat redirect as error (else sites would e.g. forward to their localized version such as
    // https://example.com/de/remote-attestation.json)
    // ignore cache in order to register missing remote-attestation.json
    const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-cache",
    });
    // treat non-ok responses as errors
    if (response.ok)
        return response.json();
    else
        throw new Error("failed to fetch attestation info");
}

export async function fetchAttestationReport(url, path) {
    const response = await fetch(new URL(path, url).href, {
        method: "GET",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-cache",
    });
    // treat non-ok responses as errors
    if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return new attestation.AttestationReport(arrayBuffer);
    } else {
        throw new Error("failed to fetch attestation report");
    }
}

/**
 * @param chipId
 * @param committedTCB
 * @param {boolean} [reload]
 * @return {Promise<Certificate>}
 */
export async function fetchVCEK(chipId, committedTCB, reload) {
    // AMD key server
    const KDSINF = "https://kdsintf.amd.com/vcek/v1/Genoa/";

    // Query to Amd key sever including the used TCB
    // https://kdsintf.amd.com/vcek/v1/Milan/<5b-machine-id-a2654>/?blSPL=02&teeSPL=00&snpSPL=06&ucodeSPL=55
    function getKdsURL(chip_id, tcbObj) {
        var url = KDSINF + util.arrayBufferToHex(chip_id, false) + "?";
        url += "blSPL=" + util.zeroPad(tcbObj.blSPL, 2) + "&";
        url += "teeSPL=" + util.zeroPad(tcbObj.teeSPL, 2) + "&";
        url += "snpSPL=" + util.zeroPad(tcbObj.snpSPL, 2) + "&";
        url += "ucodeSPL=" + util.zeroPad(tcbObj.ucodeSPL, 2);
        //console.log(url);
        return url;
    }

    const kdsUrl = getKdsURL(chipId, committedTCB)

    // Query the AMD key server for VCEK certificate using chip_id and TCB from report
    // let fetch-api cache the response
    const response = await fetch(kdsUrl, {
        method: "GET",
        cache: (reload) ? "reload" : "force-cache",
        referrerPolicy: "no-referrer"
    });
    if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const asn1 = asn1js.fromBER(arrayBuffer);
        if (asn1.offset === -1)
            throw new Error("Incorrect encoded ASN.1 data");
        return new pkijs.Certificate({schema: asn1.result})
    } else {
        throw new Error("failed to fetch VCEK");
    }
}

export async function fetchMeasurementRepo(url) {
    const response = await fetch(url, {
        method: "GET",
        referrerPolicy: "no-referrer"
    });
    if (response.ok)
        return response.json();
    else
        throw new Error("failed to fetch measurement repo");
}

export async function getMeasurementFromRepo(url, version) {
    try {
        const measurements = await fetchMeasurementRepo(url);
        if (measurements.hasOwnProperty(version)) {
            return measurements[version];
        } else {
            return null;
        }
    } catch (e) {
        console.log(e);
        return null;
    }
}
