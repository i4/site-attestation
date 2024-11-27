#include <utility>

#include "mozilla/extensions/TlsAuthCertObserverRunnable.h"
#include "mozilla/extensions/TlsExtPromiseHandler.h"
#include "mozilla/extensions/TlsExtUtil.h"

namespace mozilla::extensions {
extern LazyLogModule gTLSEXTLog;

NS_IMPL_ISUPPORTS(TlsAuthCertObsRunnable, nsIRunnable)

TlsAuthCertObsRunnable::TlsAuthCertObsRunnable(PRFileDesc* fd, nsCOMPtr<nsITlsAuthCertificateObserver> obs, mozilla::Monitor& monitor, SECStatus& result):
    mozilla::Runnable("TlsAuthCertObsRunnable"), fd(fd), monitor(monitor), result(result) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Copying obs!\n"));
        this->obs = std::move(obs);
    };

NS_IMETHODIMP
TlsAuthCertObsRunnable::Run() {
    // run the actual callback
    mozilla::dom::Promise* promise;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Calling js OnAuthCertificate [%p]!\n", fd));
    nsresult rv = obs->OnAuthCertificate(TlsExtUtil::PtrToStr(fd).c_str(), &promise);
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Called js OnAuthCertificate [%p]!\n", fd));

    if (NS_FAILED(rv) || !promise) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("OnAuthCertificate failed!\n"));
        mozilla::MonitorAutoLock lock(monitor);
        monitor.Notify();
        return rv;
    }

    RefPtr<TlsAuthCertPromiseHandler> handler = new TlsAuthCertPromiseHandler(monitor, result);
    promise->AppendNativeHandler(handler);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Created and Added Promise Handler!\n"));

    return NS_OK;
}
}
