import './style.css';
import '../style/button.css';

import * as storage from '../lib/storage';

const icon = document.getElementById("attestation-icon");
const headerText = document.getElementById("attestation-header");
const urlText = document.getElementById("attestation-url");
const infoText = document.getElementById("attestation-info");
const removeButton = document.getElementById("button-remove-trust");
const settingsButton = document.getElementById("button-settings");

let tab, host;

removeButton.addEventListener("click", async () => {
    await storage.removeHost(host.href);
    browser.tabs.reload(tab.id);
});

settingsButton.addEventListener("click", () => browser.runtime.openOptionsPage());

async function getTab() {
    try {
        const tabs = await browser.tabs.query({currentWindow: true, active: true});
        return tabs[0]; // Safe to assume there will only be one result
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function init() {
    tab = await getTab();
    const url = new URL(tab.url)
    host = new URL(url.origin);

    // The hostInfo is stored for each hostname, instead of each href with the old extension.
    // This is a limitation of the TlsExt web-extension API.
    const hostInfo = await storage.getHost(host.hostname);

    urlText.innerText = host.href;

    if (hostInfo.author_key) {
        icon.setAttribute("src", "./check-mark.svg");
        headerText.innerText = "Attestation Successful";
        infoText.innerHTML = `Trusted since ${hostInfo.trustedSince.toLocaleString()}&nbsp—&nbsp<b>trust inherited from author key</b>`;
    } else if (hostInfo.trusted_measurement_repo) {
        icon.setAttribute("src", "./check-mark.svg");
        headerText.innerText = "Attestation Successful";
        infoText.innerHTML = `Trusted since ${hostInfo.trustedSince.toLocaleString()}&nbsp—&nbsp<b>trust inherited from repository</b>`;
    } else if (hostInfo.ignore) {
        icon.setAttribute("src", "./hazard-sign.svg");
        headerText.innerText = "Attestation Ignored";
        infoText.innerText = "";
        removeButton.innerText = "remove ignore";
        removeButton.classList.remove("invisible");
    } else if (hostInfo.trusted) {
        icon.setAttribute("src", "./check-mark.svg");
        headerText.innerText = "Attestation Successful";
        infoText.innerText = `Trusted since ${hostInfo.trustedSince.toLocaleString()}`;
        removeButton.innerText = "remove trust";
        removeButton.classList.remove("invisible");
    } else {
        icon.setAttribute("src", "./hazard-sign.svg");
        headerText.innerText = "Attestation Failed";
        infoText.innerText = "";
        removeButton.classList.add("invisible");
    }
}

window.addEventListener("load", init);
browser.storage.onChanged.addListener(init);
