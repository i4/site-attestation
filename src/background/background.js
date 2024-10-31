import * as pkijs from "pkijs";
import * as asn1js from "asn1js";

import * as util from "../lib/util";
import {fetchArrayBuffer, fetchAttestationInfo, getMeasurementFromRepo} from "../lib/net";
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

async function queryRATLSTab() {
    const queryInfo = {
        // ! the url field can not be used, since a TLS connection is opened prior to the url bar reflecting the url
        // ! thus we cannot query a tab based on its url
        // ! This is a huge oversight, since race conditions could occur here, maybe there is a better solution?
        // ! TODO
        // url: `*://${host}/*`,
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
    try {
        if (messageSSLHandshakeType !== browser.tlsExt.SSLHandshakeType.SSL_HS_CLIENT_HELLO)
            return null;

        console.log("writer");
        console.log(details);

        // TODO generate proper nonce
        const nonce = "3";

        await storage.setNonce(details.url, nonce);
        return nonce;
    } catch (e) {
        console.error("writer listener failed", e);
        return null;
    }
}

browser.tlsExt.onWriteTlsExtension.addListener(listenerOnWriteTlsExtension, ".*", 420);

async function listenerOnHandleTlsExtension(messageSSLHandshakeType, data, details) {
    try {
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

        console.log(arrayBufferToHex(hostAttestationInfo.attestationReport.measurement, true));

        const isKnown = await storage.isKnownHost(details.url);
        const tab = await queryRATLSTab();
        if (!tab) {
            console.log(`could not find tab for ${details.url}`);
            return browser.tlsExt.SECStatus.SECFAILURE; // could not find the tab causing the TLS connection
        }

        console.log("getting last request target");
        const targetUrl = await storage.getLastRequestTarget(tab.id);
        console.log("got target url ", targetUrl, " for tab ", tab.id);
        console.log("handler for tab with url: ", targetUrl);

        console.log("trying to get AR");
        try {
            console.log("AR is: ", hostAttestationInfo.attestationReport);
        } catch (e) {
            console.error(e);
        }
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
                url: buildParamUrl(NEW_ATTESTATION_PAGE, targetUrl, details.url)
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
                url: buildParamUrl(BLOCKED_ATTESTATION_PAGE, targetUrl, details.url)
            });
            return browser.tlsExt.SECStatus.SECFAILURE;
        }

        console.log("host is not untrusted");

        // can the already known host be trusted?
        const storedAR = await storage.getAttestationReport(details.url);
        if (storedAR &&
            arrayBufferToHex(hostAttestationInfo.attestationReport.measurement) === arrayBufferToHex(storedAR.measurement) &&
            await checkHost(hostAttestationInfo)) {
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
                url: buildParamUrl(DIFFERS_ATTESTATION_PAGE, targetUrl, details.url)
            });
            return browser.tlsExt.SECStatus.SECFAILURE;
        }

        console.log("trusted successfully");
        await showPageAction(tab.id, true);
        return browser.tlsExt.SECStatus.SECSUCCESS;
    } catch (e) {
        console.error("handler listener failed", e);
        // An error has occurred and could have been caused by a server mishandling the protocol, thus
        // refuse the connection, in order to protect the client.
        return browser.tlsExt.SECStatus.SECFAILURE;
    }
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

async function onStartup() {
    console.log("startup");
    try {
        // acquire revocation list on startup // TODO: currently only for one architecture
        // AMD key server
        const AMD_ARK_ASK_REVOCATION = "https://kdsintf.amd.com/vcek/v1/Genoa/crl" // TODO: derive architecture from AR

        console.log("fetching revocation list");
        const crl_arrayBuffer = await fetchArrayBuffer(AMD_ARK_ASK_REVOCATION);
        console.log("fetched revocation list");

        // TODO: error handling
        await storage.setCrl("Genoa", crl_arrayBuffer);
    } catch (e) {
        console.error(e);
    }
}

browser.runtime.onStartup.addListener(onStartup);
onStartup(); // TODO: somehow onStartup listener is not called, so call it manually

async function listenerOnBeforeRequest(details) {
    console.log("webrequest for ", details.url, " in tab ", details.tabId);
    await storage.setLastRequestTarget(details.tabId, details.url);
}

browser.webRequest.onBeforeRequest.addListener(
    listenerOnBeforeRequest,  // ! if racing conditions for the url occur, make this listener blocking ;)
    {urls: ['https://*/*'], types: ['main_frame']});
