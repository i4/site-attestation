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
      },
    };
  }
};
