
#ifndef mozilla_extensions_nsTlsExtensionService_h__
#define mozilla_extensions_nsTlsExtensionService_h__

#include <list>
#include <map>
#include <regex>

#include "nsITlsExtensionService.h"
#include "prtypes.h"
#include "seccomon.h"
#include "sslt.h"
#include "prio.h"
#include "ssl.h"
#include "prlock.h"
#include "nsCOMPtr.h"
#include "nsThreadUtils.h"
#include "mozilla/Monitor.h"

namespace mozilla::extensions {

class TlsExtensionService final : public nsITlsExtensionService {
    public:

    NS_DECL_ISUPPORTS
    NS_DECL_NSITLSEXTENSIONSERVICE

    using TlsExtObserverInfo = struct TlsExtObserverInfo {
        std::regex* urlPattern;
        PRUint16 extension;
        nsCOMPtr<nsITlsExtensionObserver> observer;
        char* hostname;
    };

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

    SECStatus InstallObserverHooks(PRFileDesc* sslSock, const char* host);

    std::map<PRUint16, TlsExtObserverInfo*> GetObservers();

    class ObserverRunnable : public mozilla::Runnable {
        public:
        NS_DECL_ISUPPORTS
        NS_DECL_NSIRUNNABLE

        ObserverRunnable(TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor, char*& result);

        private:
        ~ObserverRunnable() = default;

        TlsExtObserverInfo* obsInfo;
        mozilla::Monitor& monitor;
        char*& result;
    };

    private:
    std::map<PRUint16, TlsExtObserverInfo*> observers;
    PRLock* observersLock;

    TlsExtensionService();
    ~TlsExtensionService();
};

}


#endif
