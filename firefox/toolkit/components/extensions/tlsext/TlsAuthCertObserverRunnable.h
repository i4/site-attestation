#ifndef mozilla_extensions_TlsAuthCertObserverRunnable_h__
#define mozilla_extensions_TlsAuthCertObserverRunnable_h__

#include "mozilla/Monitor.h"
#include "nsITlsExtensionService.h"
#include "nsThreadUtils.h"
#include "prio.h"
#include "seccomon.h"

namespace mozilla::extensions {
class TlsAuthCertObsRunnable : public mozilla::Runnable {
    public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIRUNNABLE

    TlsAuthCertObsRunnable(PRFileDesc* fd, nsCOMPtr<nsITlsAuthCertificateObserver>& obs, mozilla::Monitor& monitor, SECStatus& result);

    private:
    ~TlsAuthCertObsRunnable() = default;

    PRFileDesc* fd;
    nsCOMPtr<nsITlsAuthCertificateObserver>& obs;
    mozilla::Monitor& monitor;
    SECStatus& result;
};
}

#endif
