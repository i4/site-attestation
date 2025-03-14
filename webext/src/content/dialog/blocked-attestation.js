import './style.css';
import '../../style/button.css'

import {getHostInfo, types} from "../../lib/messaging";
import * as storage from "../../lib/storage";
import {getHostParam, getOriginParam} from "./dialog";

const titleText = document.getElementById("title");
const domainText = document.getElementById("domain");
const descriptionText = document.getElementById("description");

const unblockButton = document.getElementById("unblock-button");

const origin = getOriginParam();
const host = getHostParam();

unblockButton.addEventListener("click", async () => {
    await storage.removeHost(host);
    browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
});

window.addEventListener("load", async () => {
    domainText.innerText = host;
});
