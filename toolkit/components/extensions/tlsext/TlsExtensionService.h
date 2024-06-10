
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include "nsITlsExtensionService.h"


namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    static already_AddRefed<TlsExtensionService> GetSingleton();

    private:
    TlsExtensionService() = default;
    ~TlsExtensionService() = default;
};

}


#endif
