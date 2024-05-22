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

this.tlsExt = class extends ExtensionAPI {
  getAPI(context) {
    return {
      tlsExt: {
        getTlsExtensionSupport: function (extension) {
          if (extension < 0)
            throw new ExtensionError("Cannot");
          return extension;
        },
      },
    };
  }
};
