import {fetchAttestationReport} from "../../lib/net";
import {arrayBufferToHex} from "../../lib/util";
import * as storage from "../../lib/storage";
import {types} from "../../lib/messaging";
import {AttestationReport} from "../../lib/attestation";

export async function getReport(hostInfo) {
    return new AttestationReport(hostInfo.ar_arrayBuffer);
}

export async function listenerTrustMeasurement(hostInfo, ar, origin) {
    await storage.newTrusted(
        hostInfo.host, new Date(), new Date(), "tech", ar.arrayBuffer, hostInfo.ssl_sha512); // TODO sha
    return browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
}

export async function listenerTrustRepo(hostInfo, ar, origin) {
    await storage.newTrusted(
        hostInfo.host, new Date(), new Date(), hostInfo.attestationInfo.technology, ar.arrayBuffer, hostInfo.ssl_sha512);
    await storage.setMeasurementRepo(hostInfo.host, hostInfo.attestationInfo.measurement_repo); // TODO attestationInfo does not exist anymore
    return browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
}

export async function listenerTrustAuthor(hostInfo, ar, origin) {
    await storage.newTrusted(
        hostInfo.host, new Date(), new Date(), hostInfo.attestationInfo.technology, ar.arrayBuffer, hostInfo.ssl_sha512);
    await storage.setAuthorKey(hostInfo.host, arrayBufferToHex(ar.author_key_digest));
    return browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
}

export function buildParamUrl(dialogUrl, originUrl, host) {
    return `${dialogUrl}?origin=${originUrl}&host=${host}`;
}

export function getOriginParam() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get("origin");
}

export function getHostParam() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get("host");
}
