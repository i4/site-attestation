import './style.css';
import '../../style/button.css';

import {getHostInfo, types} from "../../lib/messaging";
import * as storage from "../../lib/storage";
import {getHostParam, getOriginParam} from "./dialog";

const domainText = document.getElementById("domain");
const removeButton = document.getElementById("remove-record-button");

const origin = getOriginParam();
const host = getHostParam();

removeButton.addEventListener("click", async () => {
    await storage.removeHost(host);
    browser.runtime.sendMessage({
        type : types.redirect,
        url : origin
    });
});

window.addEventListener("load", async () => {
    domainText.innerText = host;

    removeButton.classList.remove("invisible");
});
