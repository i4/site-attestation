
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include <unordered_set>
#include "nsITlsExtensionService.h"
#include "prtypes.h"
#include "seccomon.h"
#include "sslt.h"
#include "prio.h"
#include "ssl.h"

namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    struct ExtensionCallbackArg {
        const char* hostname;

        // ExtensionCallbackArg(const char* hostname);
        // ~ExtensionCallbackArg();
    };

    static const PRUint16 DEFAULT_EXTENSION = 420;

    static already_AddRefed<TlsExtensionService> GetSingleton();

    static PRBool onNSS_SSLExtensionWriter(
        PRFileDesc *fd,
        SSLHandshakeType messageType,
        PRUint8 *data,
        unsigned int *len,
        unsigned int maxLen,
        void *callbackArg
    );
    static SECStatus onNSS_SSLExtensionHandler(
        PRFileDesc *fd,
        SSLHandshakeType messageType,
        const PRUint8 *data,
        unsigned int len,
        SSLAlertDescription *alert,
        void *callbackArg
    );

    private:
    // std::unordered_set<ExtensionCallbackArg*> callbackArgs();

    TlsExtensionService() = default;
    ~TlsExtensionService() = default;
};

}


#endif
