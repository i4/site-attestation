// from NSS sslexp.h
const SSLExtensionSupportDict = ["ssl_ext_none", "ssl_ext_native", "ssl_ext_native_only"];
// from NSS sslt.h
const SSLHandshakeTypeDict = {
  0: "ssl_hs_hello_request",
  1: "ssl_hs_client_hello",
  2: "ssl_hs_server_hello",
  3: "ssl_hs_hello_verify_request",
  4: "ssl_hs_new_session_ticket",
  5: "ssl_hs_end_of_early_data",
  6: "ssl_hs_hello_retry_request",
  8: "ssl_hs_encrypted_extensions",
  11: "ssl_hs_certificate",
  12: "ssl_hs_server_key_exchange",
  13: "ssl_hs_certificate_request",
  14: "ssl_hs_server_hello_done",
  15: "ssl_hs_certificate_verify",
  16: "ssl_hs_client_key_exchange",
  20: "ssl_hs_finished",
  22: "ssl_hs_certificate_status",
  24: "ssl_hs_key_update",
  67: "ssl_hs_next_proto",
  254: "ssl_hs_message_hash",           /* Not a real message. */
  257: "ssl_hs_ech_outer_client_hello"  /* Not a real message. */
};
// from NSS seccommon.h
const SECStatusDict = {
  "SECWouldBlock": -2,
  "SECFailure": -1,
  "SECSuccess": 0
};

function createWriteObserver(fire) {
  return function (extension, tlsSessionId, url, messageType, maxDataLen) {
    console.log("writer called");
    if (fire !== null) {
      console.log(messageType);
      return fire.async(
        SSLHandshakeTypeDict[messageType],
        maxDataLen,
        { "sessionId": tlsSessionId, "url": url, "extension": extension });
    }
    return Promise.resolve(null);
  };
}

function createHandleObserver(fire) {
  return async function (extension, tlsSessionId, url, messageType, data, tlsCertString) {
    console.log("handler called");
    if (fire !== null) {
      const secStatus = await fire.async(
        SSLHandshakeTypeDict[messageType],
        data,
        { "sessionId": tlsSessionId, "url": url, "extension": extension, "tlsCertString": tlsCertString });
      return SECStatusDict[secStatus];
    }
    return Promise.resolve(SECStatusDict.SECSuccess);
  };
}

function createAuthCertObserver(fire) {
  return async function (tlsSessionId) {
    console.log("authCert observer called");
    if (fire !== null) {
      const secStatus = await fire.async(tlsSessionId);
      return SECStatusDict[secStatus];
    }
    return Promise.resolve(SECStatusDict.SECSuccess);
  };
}

this.tlsExt = class extends ExtensionAPI {

  getAPI(context) {
    return {
      tlsExt: {
        getTlsExtensionSupport: (extension) => SSLExtensionSupportDict[Services.tlsExtensions.getExtensionSupport(extension)],
        removeAuthCertificateListener: (sessionId) => Services.tlsExtensions.removeAuthCertificateObserver(sessionId),

        onWriteTlsExtension: new EventManager({
          context,
          name: "tlsExt.onWriteTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = createWriteObserver(fire);
            Services.tlsExtensions.addWriterObserver(urlPattern, extension, observer);
            return () => {
              Services.tlsExtensions.removeWriterObserver(extension);
            };
          }
        }).api(),

        onHandleTlsExtension: new EventManager({
          context,
          name: "tlsExt.onHandleTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = createHandleObserver(fire);
            Services.tlsExtensions.addHandlerObserver(urlPattern, extension, observer);
            return () => {
              Services.tlsExtensions.removeHandlerObserver(extension);
            };
          }
        }).api(),

        onAuthCertificate: new EventManager({
          context,
          name: "tlsExt.onAuthCertificate",
          register: (fire, tlsSessionId) => {
            console.log("registering onAuthCertificate");
            const observer = createAuthCertObserver(fire);
            Services.tlsExtensions.addAuthCertificateObserver(tlsSessionId, observer);
            return () => {
              Services.tlsExtensions.removeAuthCertificateObserver(tlsSessionId);
            };
          }
        }).api(),
      },
    };
  }
};
