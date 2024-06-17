// this.tlsExt = class extends ExtensionAPI {
//   getAPI(context) {
//     return {
//       tlsExt: {
//         getTlsExtensionSupport(extension) {
//           throw new ExtensionError("Dies ist ein Test");
//           return extension;
//         },
//         onTlsExtensionHandle: new EventManager({
//           context,
//           name: "tlsExt.onTlsExtensionHandle",
//           register: fire => {
//             const callback = value => {
//               fire.async(value);
//             };
//             RegisterSomeInternalCallback(callback);
//             return () => {
//               UnregisterInternalCallback(callback);
//             };
//           }
//         }).api(),
//       }
//     }
//   }
// }

ChromeUtils.defineESModuleGetters(this, {
  TlsExtensionObserver: "resource://gre/modules/TlsExtensionObserver.sys.mjs",
});

const SSLExtensionSupport = ["ssl_ext_none", "ssl_ext_native", "ssl_ext_native_only"];

function createObserver() {
  // const tlsExtensionObserverCID = "@mozilla.org/extensions/tls-extension-observer;1";
  // return Cc[tlsExtensionObserverCID].createInstance(Ci.nsITlsExtensionObserver);
  // return Services.tlsExtensionsObserver.QueryInterface(Ci.nsITlsExtensionObserver);
  return new TlsExtensionObserver();
}

// function addHandleObserver() {
//   // TODO
// }

// function addWriteObserver() {
//   let observer = {

//   }
// }

this.tlsExt = class extends ExtensionAPI {

  getAPI(context) {
    return {
      tlsExt: {
        getTlsExtensionSupport: (extension) => SSLExtensionSupport[Services.tlsExtensions.getExtensionSupport(extension)],

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

        onWriteTlsExtension: new EventManager({
          context,
          name: "tlsExt.onWriteTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = createObserver();
            observer.setWriteTlsExtensionCallback(fire);
            console.log(observer);
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
