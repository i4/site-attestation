#ifndef mozilla_extensions_TlsAuthCertObserverRunnable_h__
#define mozilla_extensions_TlsAuthCertObserverRunnable_h__

#include "mozilla/Monitor.h"
#include "nsITlsExtensionService.h"
#include "nsThreadUtils.h"
#include "prio.h"

namespace mozilla::extensions {
class TlsAuthCertObserverRunnable : public mozilla::Runnable {
    public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIRUNNABLE

    TlsAuthCertObserverRunnable(PRFileDesc* fd, nsITlsAuthCertificateObserver* obs, mozilla::Monitor& monitor):
        mozilla::Runnable("TlsAuthCertObserverRunnable"), fd(fd), obs(obs), monitor(monitor) {};

    private:
    PRFileDesc* fd;
    nsITlsAuthCertificateObserver* obs;
    mozilla::Monitor& monitor;
};
}

#endif
