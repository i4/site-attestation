
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include "nsITlsExtensionService.h"


namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    public:
    TlsExtensionService() = default;

    private:
    // A private destructor must be declared.
    ~TlsExtensionService() = default;
};

}


#endif
