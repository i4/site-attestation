
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include "nsITlsExtensionService.h"

#include "mozilla/ClearOnShutdown.h"

#include "sslexp.h"


namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    // static already_AddRefed<TlsExtensionService> GetSingleton();

    TlsExtensionService() = default;

    private:
    ~TlsExtensionService() = default;
};

}


#endif
