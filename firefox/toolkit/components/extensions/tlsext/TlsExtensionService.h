
#ifndef mozilla_extensions_TlsExtensionService_h__
#define mozilla_extensions_TlsExtensionService_h__

#include <map>

#include "nsITlsExtensionService.h"
#include "prtypes.h"
#include "seccomon.h"
#include "sslt.h"
#include "prio.h"
#include "ssl.h"
#include "prlock.h"
#include "mozilla/extensions/TlsExtObserverInfo.h"
#include "mozilla/extensions/TlsAuthCertificateObserverInfo.h"

namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

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

    static SECStatus onNSS_SSLAuthCertificate(
        PRFileDesc *fd
    );

    SECStatus InstallObserverHooks(PRFileDesc* sslSock, const char* host);

    std::map<PRUint16, TlsExtObserverInfo*> GetObservers();

    private:
    std::map<PRUint16, TlsExtObserverInfo*> observers;
    PRLock* observersLock;

    std::map<PRFileDesc*, nsCOMPtr<nsITlsAuthCertificateObserver>> authCertObservers;
    PRLock* authCertObserversLock;

    TlsExtensionService();
    ~TlsExtensionService();

    TlsExtObserverInfo* GetOrCreateObserver(PRUint16 extension);
    void RemoveObserver(PRUint16 extension);
    void RemoveAuthCertificateObserver(PRFileDesc* fd);
};
}

#endif
