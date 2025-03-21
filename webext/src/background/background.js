import * as pkijs from "pkijs";
import * as asn1js from "asn1js";

import * as util from "../lib/util";
import {fetchArrayBuffer, fetchAttestationInfo, getMeasurementFromRepo} from "../lib/net";
import * as storage from "../lib/storage";
import * as messaging from "../lib/messaging";
import {DialogType} from "../lib/ui";
import {checkHost, validateAuthorKey, validateMeasurement} from "../lib/crypto";
import {AttestationReport} from "../lib/attestation";
import {arrayBufferToHex, checkAttestationInfoFormat, generateNonce, hasDateChanged} from "../lib/util";
// import {pmark, pmeasure} from "../lib/evaluation";
import {removeUnsupported} from "../lib/storage";
import * as attestation from "../lib/attestation";
import {buildParamUrl} from "../content/dialog/dialog";
import {isEmpty} from "lodash";
import {HostAttestationInfo} from "./HostAttestationInfo";

const NEW_ATTESTATION_PAGE = browser.runtime.getURL("new-remote-attestation.html");
const BLOCKED_ATTESTATION_PAGE = browser.runtime.getURL("blocked-remote-attestation.html");
const MISSING_ATTESTATION_PAGE = browser.runtime.getURL("missing-remote-attestation.html");
const DIFFERS_ATTESTATION_PAGE = browser.runtime.getURL("differs-remote-attestation.html");

browser.runtime.onStartup.addListener(onStartup);
onStartup(); // onStartup Event is not called, if the extension is newly installed

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
    console.log("writer", details.url);
    try {
        if (messageSSLHandshakeType !== browser.tlsExt.SSLHandshakeType.SSL_HS_CLIENT_HELLO)
            return null;

        console.log("writer");
        console.log(details);

        // TODO generate proper nonce
        // const nonce = "3";
        const nonce = generateNonce();

        console.log("adding auth cert hook for ", details.sessionId);
        if (await storage.isTrusted(details.url)) {
            await storage.setAwaitingRA(details.url, true);
            browser.tlsExt.onAuthCertificate.addListener(async function(sessionId) {
                    try {
                        const awaitingRA = await storage.getAwaitingRA(details.url);
                        console.log("got awaitingRA", awaitingRA);
                        if (awaitingRA) {
                            console.log("awaitingRA was not unset");

                            const tab = await queryRATLSTab();
                            const targetUrl = await storage.getLastRequestTarget(tab.id);
                            browser.tabs.update(tab.id, {
                                url: buildParamUrl(MISSING_ATTESTATION_PAGE, targetUrl, details.url)
                            });

                            // cleaning up listener
                            browser.tlsExt.removeAuthCertificateListener(sessionId);
                            return browser.tlsExt.SECStatus.SECFAILURE;
                        }

                        console.log("awaitingRA was unset");

                        // cleaning up listener // TODO: does this leave artifacts in Firefox?
                        browser.tlsExt.removeAuthCertificateListener(sessionId);
                        return browser.tlsExt.SECStatus.SECSUCCESS
                    } catch (e) {
                        console.error(e);
                    }
                }, details.sessionId);
        }

        console.log("writing nonce", nonce);
        await storage.setNonce(details.sessionId, nonce);
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

        console.log("unsetting awaitingRA");
        await storage.setAwaitingRA(details.url, false);

        const nonce = await storage.getNonce(details.sessionId);
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

        // was a measurement pre-configured (e.g. in settings)
        const configMeasurement = await storage.getConfigMeasurement(details.url);
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
        } else if (configMeasurement &&
            configMeasurement === arrayBufferToHex(hostAttestationInfo.attestationReport.measurement) &&
            await checkHost(hostAttestationInfo)) {

            // remove the configured measurement and store the actual attestation report
            await storage.setTrusted(details.url, {
                lastTrusted: new Date(),
                ar_arrayBuffer: hostAttestationInfo.attestationReport.arrayBuffer,
            });
            await storage.removeConfigMeasurement(details.url);
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
    console.log("received message", message);
    // evaluation purposes only
    if (message.type === messaging.types.evaluationTrust) {
        console.log("configuring measurement");
        await storage.setObjectProperties(message.url, {
            trustedSince: new Date(),
            config_measurement: message.config_measurement,
            trusted: true
        });
        return;
    }

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
    }
}

browser.runtime.onMessage.addListener(listenerOnMessageReceived);

async function onStartup() {
    console.log("startup");
    try {
        // TODO: for evaluation build only!
        // console.log("setting up evaluation");
        // await storage.setObjectProperties("localhost", {
        //     trustedSince: new Date(),
        //     config_measurement: "e5699e0c270f3e5bfd7e2d9dc846231e99297d55d0f7c6f894469eb384b3402239b72c0c28a49e231e8a1a62314309b4",
        //     trusted: true
        // });
        // console.log("localhost config measurement is ", await storage.getConfigMeasurement("localhost"));
        // await storage.setObjectProperties("i4epyc1.cs.fau.de", {
        //     trustedSince: new Date(),
        //     config_measurement: "e5699e0c270f3e5bfd7e2d9dc846231e99297d55d0f7c6f894469eb384b3402239b72c0c28a49e231e8a1a62314309b4",
        //     trusted: true
        // });
        // console.log("i4epyc1.cs.fau.de config measurement is ", await storage.getConfigMeasurement("localhost"));

        // acquire revocation list on startup // TODO: currently only for one architecture
        // AMD key server
        const AMD_ARK_ASK_REVOCATION = "https://kdsintf.amd.com/vcek/v1/Genoa/crl" // TODO: derive architecture from AR

        console.log("fetching revocation list");
        const crl_arrayBuffer = await fetchArrayBuffer(AMD_ARK_ASK_REVOCATION);
        console.log("fetched revocation list");

        if (!crl_arrayBuffer)
            console.error("CRL could not be loaded");

        console.log(crl_arrayBuffer);

        // TODO: error handling
        await storage.setCrl("Genoa", crl_arrayBuffer);
    } catch (e) {
        console.error(e);
    }
}

// async function trackTabUrls() {
//     async function handleCreated(tab) {
//         console.log("Created tab", tab.url);
//     }
//
//     async function handleUpdated(tabId, changeInfo, tab) {
//         console.log("Updated tab", tab.url, changeInfo.url);
//     }
//
//     async function handleRemoved(tabId, removeInfo) {
//         console.log("Removed tab");
//     }
//
//     browser.tabs.onCreated.addListener(handleCreated);
//     browser.tabs.onUpdated.addListener(handleUpdated);
//     browser.tabs.onRemoved.addListener(handleRemoved);
// }

trackTabUrls();
async function listenerOnBeforeRequest(details) {
    console.log("webrequest for ", details.url, " in tab ", details.tabId);
    await storage.setLastRequestTarget(details.tabId, details.url);
    // better approach using tabs API: https://stackoverflow.com/a/46644672 => does not work, changeInfo does not
    // hold the new url
}

browser.webRequest.onBeforeRequest.addListener(
    listenerOnBeforeRequest,  // ! if racing conditions for the url occur, make this listener blocking ;)
    {urls: ['https://*/*'], types: ['main_frame']});
