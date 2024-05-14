this.TLSExt = class extends ExtensionAPI {
  getAPI(context) {
    return {
      TLSExt: {
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
      }
    }
  }
}
