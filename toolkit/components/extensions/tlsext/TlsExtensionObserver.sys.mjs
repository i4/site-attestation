import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

/**
 * @class
 */
export function TlsExtensionObserver() {
    // init
    console.log("testing");
    this.handleFire = null;
    this.writeFire = null;
    return this;
}

// implement addListener functions here
TlsExtensionObserver.prototype = {
    classID: Components.ID("{62d09cd3-c717-4cff-a04f-4e0facc11cd5}"),
    // contractID: "@mozilla.org/extensions/tls-extension-observer;1",

    // nsIMIMEInfo: Ci.nsIMIMEInfo,

    QueryInterface: ChromeUtils.generateQI([
        // Components.interfaces.nsITlsExtensionObserver
        "nsITlsExtensionObserver"
    ]),

    setWriteTlsExtensionCallback(callback) {
        this.writeFire = callback;
    },
    setHandleTlsExtensionCallback(callback) {
        this.handleFire = callback;
    },

    async onWriteTlsExtension(tlsSessionId, url, messageType, maxDataLen) {
        if (this.writeFire !== null)
            return await this.writeFire.async(); // TODO parse return, pass arguments
        return null;
    },
    async onHandleTlsExtension(tlsSessionId, url, messageType, data) {
        if (this.handleFire !== null)
            return await this.handleFire.async();
        return 1; // TODO return SECFailure, but how to access the ns Interface enums?
    },
}
