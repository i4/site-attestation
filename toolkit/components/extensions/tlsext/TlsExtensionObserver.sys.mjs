
/**
 * @class
 */
export function TlsExtensionObserver() {
    // init
}

// implement addListener functions here
TlsExtensionObserver.prototype = {
    setWriteTlsExtensionCallback(callback) {
        this.onWriteTlsExtension = callback;
    },
    setHandleTlsExtensionCallback(callback) {
        this.onHandleTlsExtension = callback;
    },
    onWriteTlsExtension(tlsSessionId, url, messageType, maxDataLen) { },
    onHandleTlsExtension(tlsSessionId, url, messageType, data) { },
}
