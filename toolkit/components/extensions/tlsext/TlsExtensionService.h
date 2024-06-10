
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include "nsITlsExtensionService.h"


namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    static already_AddRefed<TlsExtensionService> GetSingleton();

    static PRBool callback_SSLExtensionWriter(
        PRFileDesc *fd,
        SSLHandshakeType messageType,
        PRUint8 *data,
        unsigned int *len,
        unsigned int maxLen,
        void *arg
    );
    static SECStatus callback_SSLExtensionHandler(
        PRFileDesc *fd,
        SSLHandshakeType messageType,
        const PRUint8 *data,
        unsigned int len,
        SSLAlertDescription *alert,
        void *arg
    );

    private:
    TlsExtensionService() = default;
    ~TlsExtensionService() = default;
};

}


#endif
