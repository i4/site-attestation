this.tlsExt = class extends ExtensionAPI {
  getAPI(context) {
    return {
      tlsExt: {
        onTLSExtensionHandle: new EventManager({
          context,
          name: "TLSExt.onTLSExtensionHandle",
          register: fire => {
            const callback = value => {
              fire.async(value);
            };
            RegisterSomeInternalCallback(callback);
            return () => {
              UnregisterInternalCallback(callback);
            };
          }
        }).api(),
        getTlsExtensionSupport(extension) { return extension }
      }
    }
  }
}
