import './style.css';
import '../../style/button.css';

import {types} from '../../lib/messaging';
import * as storage from '../../lib/storage';
import {arrayBufferToHex} from "../../lib/util";
import {getHostInfo} from "../../lib/messaging";
import {
    getHostParam,
    getOriginParam,
    getReport,
    listenerTrustAuthor,
    listenerTrustMeasurement,
    listenerTrustRepo
} from "./dialog";
import {getMeasurementFromRepo} from "../../lib/net";
import {checkHost} from "../../lib/crypto";
import {HostAttestationInfo} from "../../background/HostAttestationInfo";

const titleText = document.getElementById("title");
const domainText = document.getElementById("domain");
const descriptionText = document.getElementById("description");
const measurementText = document.getElementById("measurement");
const measurementRepoText = document.getElementById("measurement-repo");
const authorKeyText = document.getElementById("author-key");

const ignoreButton = document.getElementById("ignore-button");
const noTrustButton = document.getElementById("do-not-trust-button");
const trustMeasurementButton = document.getElementById("trust-measurement-button");
const trustRepoButton = document.getElementById("trust-repo-button");
const trustAuthorKeyButton = document.getElementById("trust-author-key-button");

let ar;
const origin = getOriginParam();
const host = getHostParam();
let hostInfo;

ignoreButton.addEventListener("click", async () => {
    await storage.setIgnore(hostInfo.host, true);
    browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
});

trustMeasurementButton.addEventListener("click", async () => {
    await listenerTrustMeasurement(hostInfo, ar, origin);
});

trustRepoButton.addEventListener("click", async () => {
    await listenerTrustRepo(hostInfo, ar, origin);
});

trustAuthorKeyButton.addEventListener("click", async () => {
    await listenerTrustAuthor(hostInfo, ar, origin);
});

noTrustButton.addEventListener("click", async () => {
    await storage.setUntrusted(hostInfo.host, true);
    browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
        // type : types.block,
        // origin : origin,
        // host: host,
    });
    console.log("blocking host ", host, " redirecting to ", origin);
});

window.addEventListener("load", async () => {
    console.log("New Attestation");

    console.log("host is: " + host);
    console.log(`origin is ${origin}`);

    hostInfo = await storage.getPendingAttestationInfo(host);
    const hostAttestationInfo = new HostAttestationInfo().fromJson(hostInfo.hostAttestationInfo);
    ar = hostAttestationInfo.attestationReport;

    // init UI
    domainText.innerText = host;

    if (await checkHost(hostAttestationInfo)) {
        let makeVisible = [];

        // 4. Trust the measurement? wait for user input
        measurementText.innerText = arrayBufferToHex(hostAttestationInfo.attestationReport.measurement); // TODO: could have better performance
        descriptionText.innerHTML =
            "This host offers remote attestation, do you want to trust it?<br>" +
            "<i>You may trust its measurement.</i>";
        makeVisible.push(ignoreButton, noTrustButton, trustMeasurementButton, measurementText.parentNode);

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

        // for testing purposes only
        // trustMeasurementButton.click();
    } else {
        titleText.innerText = "Warning: Attestation Failed";
        descriptionText.innerText = "This host offers remote attestation, but the hosts implementation is broken! " +
            "You may ignore this host, but this could very well be a malicious attack.";
        ignoreButton.classList.remove("invisible");
    }
});
