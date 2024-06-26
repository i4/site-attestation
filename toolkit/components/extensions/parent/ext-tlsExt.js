const SSLExtensionSupport = ["ssl_ext_none", "ssl_ext_native", "ssl_ext_native_only"];

// function createObserver() {
//   // const tlsExtensionObserverCID = "@mozilla.org/extensions/tls-extension-observer;1";
//   // return Cc[tlsExtensionObserverCID].createInstance(Ci.nsITlsExtensionObserver);
//   // return Services.tlsExtensionsObserver.QueryInterface(Ci.nsITlsExtensionObserver);
//   return new TlsExtensionObserver();
// }

function createHandleObserver() {
  // TODO
}

function createWriteObserver(fire) {
  console.log("test callback");
  fire.async();
  let observer = new Object({
    classID: Components.ID("{62d09cd3-c717-4cff-a04f-4e0facc11cd5}"),
    contractID: "@mozilla.org/extensions/tls-extension-writer-observer;1",
    QueryInterface: ChromeUtils.generateQI(["nsITlsExtensionWriterObserver"]),

    onWriteTlsExtension(extension, tlsSessionId, url, messageType, maxDataLen) {
      console.log("writer called");
      if (fire !== null) {
        let promise = fire.async();
        // promise.then(console.log);
        return promise; // TODO parse return, pass arguments
      }
      return null; // TODO return Promise(null)?
    },
    async onHandleTlsExtension(tlsSessionId, url, messageType, data) {
      return 1; // TODO return SECFailure, but how to access the ns Interface enums?
    },
  });
  return observer;
}

this.tlsExt = class extends ExtensionAPI {

  getAPI(context) {
    return {
      tlsExt: {
        getTlsExtensionSupport: (extension) => SSLExtensionSupport[Services.tlsExtensions.getExtensionSupport(extension)],

        onWriteTlsExtension: new EventManager({
          context,
          name: "tlsExt.onWriteTlsExtension",
          register: (fire, urlPattern, extension) => {
            // const observer = createObserver();
            // observer.setWriteTlsExtensionCallback(fire);

            console.log("prior has");
            console.log(Services.tlsExtensions.hasWriterObserver(extension));
            const observer = createWriteObserver(fire);
            console.log(observer);
            Services.tlsExtensions.addWriterObserver(urlPattern, extension, observer);
            console.log("posterior has");
            console.log(Services.tlsExtensions.hasWriterObserver(extension));
            return () => {
              Services.tlsExtensions.removeWriterObserver(extension);
            };
          }
        }).api(),

        onHandleTlsExtension: new EventManager({
          context,
          name: "tlsExt.onHandleTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = createObserver();
            observer.setHandleTlsExtensionCallback(fire);
            Services.tlsExtensions.addObserver(urlPattern, extension, observer);
            return () => {
              Services.tlsExtensions.removeObserver(extension);
            };
          }
        }).api(),
      },
    };
  }
};
