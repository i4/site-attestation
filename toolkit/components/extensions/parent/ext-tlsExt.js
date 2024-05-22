this.tlsExt = class extends ExtensionAPI {
  getAPI(context) {
    return {
      tlsExt: {
        onTlsExtensionHandle: new EventManager({
          context,
          name: "tlsExt.onTlsExtensionHandle",
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
        getTlsExtensionSupport(extension) { return extension; }
      }
    }
  }
}
