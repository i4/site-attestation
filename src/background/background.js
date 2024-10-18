import * as pkijs from "pkijs";
import * as asn1js from "asn1js";

import * as util from "../lib/util";
import {fetchAttestationInfo, getMeasurementFromRepo} from "../lib/net";
import * as storage from "../lib/storage";
import * as messaging from "../lib/messaging";
import {DialogType} from "../lib/ui";
import {checkHost, validateAuthorKey, validateMeasurement} from "../lib/crypto";
import {AttestationReport} from "../lib/attestation";
import {arrayBufferToHex, checkAttestationInfoFormat, hasDateChanged} from "../lib/util";
// import {pmark, pmeasure} from "../lib/evaluation";
import {removeUnsupported} from "../lib/storage";
import * as attestation from "../lib/attestation";
import {buildParamUrl} from "../content/dialog/dialog";
import {isEmpty} from "lodash";
import {HostAttestationInfo} from "./HostAttestationInfo";

const ATTESTATION_INFO_PATH = "/remote-attestation.json";
const NEW_ATTESTATION_PAGE = browser.runtime.getURL("new-remote-attestation.html");
const BLOCKED_ATTESTATION_PAGE = browser.runtime.getURL("blocked-remote-attestation.html");
const MISSING_ATTESTATION_PAGE = browser.runtime.getURL("missing-remote-attestation.html");
const DIFFERS_ATTESTATION_PAGE = browser.runtime.getURL("differs-remote-attestation.html");

// Function requests the SecurityInfo of the established https connection
// and extracts the public key.
// return: sha521 of the public key
// TODO: refactor / rewrite?
async function querySSLFingerprint(requestId) {
    async function exportAndFormatCryptoKey(key) {
        const exported = await window.crypto.subtle.exportKey(
            "spki",
            key
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

    const securityInfo = await browser.webRequest.getSecurityInfo(requestId, {
        "rawDER": true,
    });

    try {
        if (securityInfo.state === "secure" || securityInfo.state === "unsafe") {

            const serverCert = securityInfo.certificates[0];

            // raw ASN1 encoded certificate data
            const rawDER = new Uint8Array(serverCert.rawDER).buffer

            // We collect the rawDER encoded certificate
            const asn1 = asn1js.fromBER(rawDER);
            if (asn1.offset === -1) {
                // TODO: exception caught locally
                throw new Error("Incorrect encoded ASN.1 data");
            }
            const cert_simpl = new pkijs.Certificate({schema: asn1.result});
            var pubKey = await cert_simpl.getPublicKey();
            // TODO: securityInfo already has the "subjectPublicKeyInfoDigest" field, which is "Base64 encoded SHA-256 hash of the DER-encoded public key info"

            const exported = await exportAndFormatCryptoKey(pubKey);
            // console.log(exported);
            return await util.sha512(exported);
        } else {
            console.error("querySSLFingerprint: Cannot validate connection in state " + securityInfo.state);
        }
    } catch (error) {
        console.error("querySSLFingerprint: " + error);
    }
}

// checks if the host behind the url supports remote attestation
async function getAttestationInfo(url) {
    try {
        return await fetchAttestationInfo(new URL(ATTESTATION_INFO_PATH, url.href).href)
    } catch (e) {
        // console.log(e)
        return null
    }
}

async function showPageAction(tabId, success) {
    if (success)
        await browser.pageAction.setIcon({
            tabId: tabId,
            path: "./check-mark.svg",
        });
    else
        await browser.pageAction.setIcon({
            tabId: tabId,
            path: "./hazard-sign.svg",
        });
    return browser.pageAction.show(tabId);
}

async function queryRATLSTab(host) {
    const queryInfo = {
        // url: `*://${host}/*`,    // TODO issue with URL bar being set after a TLS connection is opened
        currentWindow: true,
        active: true
    };
    try {
        const tabs = await browser.tabs.query(queryInfo);
        console.log(`found ${tabs.length} tabs`);
        if (tabs.length !== 1) return null;
        return tabs[0];
    } catch (e) {
        console.log(e);
        return null;
    }
}

async function listenerOnWriteTlsExtension(messageSSLHandshakeType, maxLen, details) {
    if (messageSSLHandshakeType !== browser.tlsExt.SSLHandshakeType.SSL_HS_CLIENT_HELLO)
        return null;

    console.log("writer");
    console.log(details);

    // const nonce = "RA_REQ:ichbineinnonce"; // TODO generate proper nonce
    const nonce = "3\0";

    try {
        await storage.setNonce(details.url, nonce);
    } catch (e) {
        console.error(e);
    }

    return nonce;
}

browser.tlsExt.onWriteTlsExtension.addListener(listenerOnWriteTlsExtension, ".*", 420);

async function listenerOnHandleTlsExtension(messageSSLHandshakeType, data, details) {
    console.log("handler unfiltered");

    if (messageSSLHandshakeType !== browser.tlsExt.SSLHandshakeType.SSL_HS_CERTIFICATE)
        return browser.tlsExt.SECStatus.SECSUCCESS;

    console.log("handler");
    console.log(data);
    console.log(details);

    const nonce = await storage.getNonce(details.url);
    if (!nonce)
        return browser.tlsExt.SECStatus.SECSUCCESS;

    const hostAttestationInfo = new HostAttestationInfo(data, details.tlsCertString, nonce);
    console.log(hostAttestationInfo)

    // TODO: does AR contain given nonce? nonce in the AR might be hashed
    // if (ar.report_data !== nonce)
    //     return browser.tlsExt.SECStatus.SECFAILURE;
    // ! This won't work: The Extension has to build a structure like '<nonce>\n<pubkey> on its won, hash it and compare it

    const isKnown = await storage.isKnownHost(details.url);
    const tab = await queryRATLSTab(details.url);   // TODO this might not work if a page's content refers to a RATLS page // ! in fact this does not really work, because it seems like a TLS connection is opened before the URL bar reflects the URL
    if (!tab) {
        console.log(`could not find tab for ${details.url}`);
        return browser.tlsExt.SECStatus.SECFAILURE; // could not find the tab causing the TLS connection
    }

    console.log("getting last request target");
    const targetUrl = await storage.getLastRequestTarget(tab.id);
    console.log("got target url ", targetUrl, " for tab ", tab.id);
    console.log("handler for tab with url: ", targetUrl);

    console.log("AR is: ", hostAttestationInfo.attestationReport);
    console.log("VCEK is: ", hostAttestationInfo.vcekCert);

    console.log(hostAttestationInfo);

    if (!isKnown) {
        console.log("host is unknown");
        await storage.setPendingAttestationInfo(details.url, {
            host: details.url, // TODO this is a hostname, not an URL
            ar_arrayBuffer: hostAttestationInfo.attestationReport.arrayBuffer,
            hostAttestationInfo: hostAttestationInfo.toJson(),
        });

        browser.tabs.update(tab.id, {
            url : buildParamUrl(NEW_ATTESTATION_PAGE, targetUrl, details.url)
        });

        return browser.tlsExt.SECStatus.SECFAILURE;
    }

    console.log("host is known");

    // host is known
    if (await storage.isIgnored(details.url)) {
        // attestation ignored -> show page action
        await showPageAction(tab.id, false);
        return browser.tlsExt.SECStatus.SECSUCCESS;
    }

    console.log("host is not ignored");

    if (await storage.isUntrusted(details.url)) {
        // host is blocked
        browser.tabs.update(tab.id, {
            url : buildParamUrl(BLOCKED_ATTESTATION_PAGE, targetUrl, details.url)
        });
        return browser.tlsExt.SECStatus.SECFAILURE;
    }

    console.log("host is not untrusted");

    // can the already known host be trusted?
    const storedAR = await storage.getAttestationReport(details.url);
    if (storedAR &&
        arrayBufferToHex(ar.measurement) === arrayBufferToHex(storedAR.measurement) // &&
        /*await checkHost({}, ar)*/) { // TODO can not do network requests while network socket is blocked -> use bundled VCEK
        // the measurement is correct and the host can be trusted
        // -> store new TLS key, update lastTrusted
        console.log("known measurement " + details.url);
        await storage.setTrusted(details.url, {
            lastTrusted: new Date(),
            // ssl_sha512: ssl_sha512,
        });
    } else {
        console.log("attestation failed " + details.url);
        browser.tabs.update(tab.id, {
            url : buildParamUrl(DIFFERS_ATTESTATION_PAGE, targetUrl, details.url)
        });
        return browser.tlsExt.SECStatus.SECFAILURE;
    }

    console.log("trusted successfully");
    await showPageAction(tab.id, true);
    return browser.tlsExt.SECStatus.SECSUCCESS;
}

browser.tlsExt.onHandleTlsExtension.addListener(listenerOnHandleTlsExtension, ".*", 420);

async function listenerOnTabUpdated(tabId, changeInfo, tab) {
    const url = new URL(tab.url);
    const host = await storage.getHost(url.host);
    if (isEmpty(host)) return; // unknown host
    if (host.trusted)
        showPageAction(tabId, true);
    else if (host.ignore)
        showPageAction(tabId, false);
}

browser.tabs.onUpdated.addListener(listenerOnTabUpdated);

async function listenerOnMessageReceived(message, sender) {
    if (sender.id !== browser.runtime.id) {
        // only accept messages by this extension
        console.log("Message by unknown sender received: " + message);
        return;
    }

    switch (message.type) {
        case messaging.types.getHostInfo:
            const hostInfo = JSON.parse(sessionStorage.getItem(sender.tab.id));
            // sendResponse() does not work
            return Promise.resolve(hostInfo);
        case messaging.types.redirect:
            browser.tabs.update(sender.tab.id, {
                url : message.url
            });
            console.log("updating tab to ", message.url);
            break;
        // case messaging.types.block:
        //     console.log("blocking tab for origin: ", message.origin, message.host);
        //     browser.tabs.update(sender.tab.id, {
        //         url : buildParamUrl(BLOCKED_ATTESTATION_PAGE, message.origin, message.host),
        //     });
        //     break;
    }
}

browser.runtime.onMessage.addListener(listenerOnMessageReceived);

browser.runtime.onStartup.addListener(async () => {
    // clear the list of unsupported hosts on browser startup, so that the extension
    // does not acquire huge amounts of user data and storage.
    await removeUnsupported();
});

async function listenerOnBeforeRequest(details) {
    console.log("webrequest for ", details.url, " in tab ", details.tabId);
    await storage.setLastRequestTarget(details.tabId, details.url);
}

browser.webRequest.onBeforeRequest.addListener(
    listenerOnBeforeRequest,
    {urls: ['https://*/*'], types: ['main_frame']},
    ["blocking"]); // TODO required?
