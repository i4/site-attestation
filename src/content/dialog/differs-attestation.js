import './style.css';
import '../../style/button.css';

import {getHostInfo, types} from "../../lib/messaging";
import * as storage from "../../lib/storage";
import {arrayBufferToHex} from "../../lib/util";
import {
    getHostParam,
    getOriginParam,
    getReport,
    listenerTrustAuthor,
    listenerTrustMeasurement,
    listenerTrustRepo
} from "./dialog";
import {AttestationReport} from "../../lib/attestation";
import {getMeasurementFromRepo} from "../../lib/net";
import {checkHost} from "../../lib/crypto";

const titleText = document.getElementById("title");
const domainText = document.getElementById("domain");
const descriptionText = document.getElementById("description");
const oldMeasurementText = document.getElementById("old-measurement");
const newMeasurementText = document.getElementById("new-measurement");
const measurementRepoText = document.getElementById("measurement-repo");
const authorKeyText = document.getElementById("author-key");

const noTrustButton = document.getElementById("do-not-trust-button");
const trustMeasurementButton = document.getElementById("trust-measurement-button");
const trustRepoButton = document.getElementById("trust-repo-button");
const trustAuthorKeyButton = document.getElementById("trust-author-key-button");

const origin = getOriginParam();
const host = getHostParam();
let hostInfo;
let ar;

trustMeasurementButton.addEventListener("click", async () => {
    // remove current form of trust
    await storage.removeHost(hostInfo.host);
    await listenerTrustMeasurement(hostInfo, ar);
});

trustRepoButton.addEventListener("click", async () => {
    // remove current form of trust
    await storage.removeHost(hostInfo.host);
    await listenerTrustRepo(hostInfo, ar);
});

trustAuthorKeyButton.addEventListener("click", async () => {
    // remove current form of trust
    await storage.removeHost(hostInfo.host);
    await listenerTrustAuthor(hostInfo, ar);
});

noTrustButton.addEventListener("click", async () => {
    await storage.setUntrusted(hostInfo.host, true);
    browser.runtime.sendMessage({
        type : types.redirect,
        url : hostInfo.url
    });
});

window.addEventListener("load", async () => {
    hostInfo = await storage.getPendingAttestationInfo(host);

    // init UI
    domainText.innerText = hostInfo.host;

    ar = await getReport(hostInfo);
    if (ar && await checkHost(hostInfo, ar)) {
        let makeVisible = [];
        const storedHostInfo = await storage.getHost(hostInfo.host);
        const oldMeasurement = (storedHostInfo.ar_arrayBuffer) ?
            arrayBufferToHex(new AttestationReport(storedHostInfo.ar_arrayBuffer).measurement) :
            storedHostInfo.configMeasurement; // TODO

        // attestation of the new measurement was successful
        descriptionText.innerHTML =
            "This host has previously been trusted, but the measurement has since changed. " +
            "Do you want to trust the new measurement? This could be a malicious attack.<br>" +
            "<i>You may trust the new measurement.</i>";
        newMeasurementText.innerText = arrayBufferToHex(ar.measurement);
        oldMeasurementText.innerText = oldMeasurement;//"da6d6b4dba2a053729026159d2f5ad12b85fb045366f200846edac079e74ade6cfc54f77a95a062534402987c2f5b9a522";//oldMeasurement;
        makeVisible.push(noTrustButton, trustMeasurementButton, newMeasurementText.parentNode, oldMeasurementText.parentNode);

        // // additionally to the changed measurement, the host now may supply a repo / author key or the user
        // // did not trust the given repo / author key, yet.
        // if (ar.author_key_en) {
        //     // this host supplies an author key
        //     // 4. Trust the author key?
        //     descriptionText.innerHTML +=
        //         "<br><br>This host also offers an <b>author key</b>.<br>" +
        //         "<i>You may trust the author key.</i><br>" +
        //         "Consequences: You trust all hosts signed by the same author key.";
        //     authorKeyText.innerText = arrayBufferToHex(ar.author_key_digest);
        //     makeVisible.push(trustAuthorKeyButton, authorKeyText.parentNode);
        // }
        // if (measurement && arrayBufferToHex(ar.measurement) === measurement) {
        //     // this host supplies a measurement using a measurement repo
        //     descriptionText.innerHTML +=
        //         "<br><br>This host also offers a <b>measurement repository</b>.<br>" +
        //         "<i>You may trust the repository.</i><br>" +
        //         "Consequences: You trust all measurement the repository contains.";
        //     measurementRepoText.setAttribute("href", hostInfo.attestationInfo.measurement_repo);
        //     measurementRepoText.innerText = hostInfo.attestationInfo.measurement_repo;
        //     makeVisible.push(trustRepoButton, measurementRepoText.parentNode);
        // }

        makeVisible.forEach(el => el.classList.remove("invisible"));
    } else {
        titleText.innerText = "Warning: Attestation Failed";
        descriptionText.innerText = "This host offers remote attestation, but the hosts implementation is broken! " +
            "You may ignore this host, but this could very well be a malicious attack.";
        ignoreButton.classList.remove("invisible");
    }
});
