
/**
 * @class
 */
export function TlsExtensionObserver() {
    // init
}

// implement addListener functions here
TlsExtensionObserver.prototype = {
    classID: Components.ID("{d4834e5a-41db-4f97-a45d-d4dc53057553}"),

    setWriteTlsExtensionCallback(callback) {
        this.onWriteTlsExtension = callback;
    },
    setHandleTlsExtensionCallback(callback) {
        this.onHandleTlsExtension = callback;
    },
    onWriteTlsExtension(tlsSessionId, url, messageType, maxDataLen) { },
    onHandleTlsExtension(tlsSessionId, url, messageType, data) { },
}
