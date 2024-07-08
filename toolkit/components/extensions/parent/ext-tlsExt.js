const SSLExtensionSupport = ["ssl_ext_none", "ssl_ext_native", "ssl_ext_native_only"];

function createWriteObserver(fire) {
  return function (extension, tlsSessionId, url, messageType, maxDataLen) {
    console.log("writer called");
    if (fire !== null) {
      console.log(messageType);
      let promise = fire.async(messageType, maxDataLen, { "sessionId": tlsSessionId, "url": url, "extension": extension });
      // promise.then(console.log);
      return promise; // TODO parse return, pass arguments
    }
    return null; // TODO return Promise(null)?
  };
}

function createHandleObserver(fire) {
  return function (extension, tlsSessionId, url, messageType, data) {
    console.log("handler called");
    if (fire !== null) {
      let promise = fire.async(messageType, data, { "sessionId": tlsSessionId, "url": url, "extension": extension });
      // promise.then(console.log);
      return promise; // TODO parse return, pass arguments
    }
    return null; // TODO return Promise(null)?
  };
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
            console.log(Services.tlsExtensions.hasHandlerObserver(extension));
            const observer = createHandleObserver(fire);
            Services.tlsExtensions.addHandlerObserver(urlPattern, extension, observer);
            console.log(Services.tlsExtensions.hasHandlerObserver(extension));
            return () => {
              Services.tlsExtensions.removeHandlerObserver(extension);
            };
          }
        }).api(),
      },
    };
  }
};
