
/**
 * @class
 */
export function TlsExtensionObserver() {
    // init
    this.handleFire = null;
    this.writeFire = null;
}

// implement addListener functions here
TlsExtensionObserver.prototype = {
    classID: Components.ID("{d4834e5a-41db-4f97-a45d-d4dc53057553}"),

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
