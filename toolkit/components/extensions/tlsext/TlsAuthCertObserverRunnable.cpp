#include "mozilla/extensions/TlsAuthCertObserverRunnable.h"
#include "mozilla/extensions/TlsExtPromiseHandler.h"
#include "mozilla/extensions/TlsExtUtil.h"

namespace mozilla::extensions {
extern LazyLogModule gTLSEXTLog;

NS_IMPL_ISUPPORTS(TlsAuthCertObsRunnable, nsIRunnable)

TlsAuthCertObsRunnable::TlsAuthCertObsRunnable(PRFileDesc* fd, nsITlsAuthCertificateObserver* obs, mozilla::Monitor& monitor, SECStatus& result):
    mozilla::Runnable("TlsAuthCertObsRunnable"), fd(fd), obs(obs), monitor(monitor), result(result) {};

NS_IMETHODIMP
TlsAuthCertObsRunnable::Run() {
    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obs->OnAuthCertificate(TlsExtUtil::PtrToStr(fd).c_str(), &promise);

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
