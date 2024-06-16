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

const SSLExtensionSupport = ["ssl_ext_none", "ssl_ext_native", "ssl_ext_native_only"];

this.tlsExt = class extends ExtensionAPI {


  getAPI(context) {
    return {
      tlsExt: {
        getTlsExtensionSupport: (extension) => SSLExtensionSupport[Services.tlsExtensions.getExtensionSupport(extension)],

        onHandleTlsExtension: new EventManager({
          context,
          name: "tlsExt.onHandleTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = new Services.tlsExtensionsObserver.constructor();
            observer.setHandleTlsExtensionCallback(fire);
            Services.tlsExtensions.addObserver(urlPattern, extension, observer);
            return () => { };
          }
        }).api(),

        onWriteTlsExtension: new EventManager({
          context,
          name: "tlsExt.onWriteTlsExtension",
          register: (fire, urlPattern, extension) => {
            const observer = new Services.tlsExtensionsObserver.constructor();
            observer.setWriteTlsExtensionCallback(fire);
            Services.tlsExtensions.addObserver(urlPattern, extension, observer);
            return () => { };
          }
        }).api(),
      },
    };
  }
};
