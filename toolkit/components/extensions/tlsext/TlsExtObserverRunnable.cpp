#include "mozilla/extensions/TlsExtObserverRunnable.h"
#include "mozilla/extensions/TlsExtPromiseHandler.h"

namespace mozilla::extensions {
NS_IMPL_ISUPPORTS(TlsExtObserverRunnable, nsIRunnable)

TlsExtObserverRunnable::TlsExtObserverRunnable(TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor, char*& result):
    mozilla::Runnable("RunObserver"),
    obsInfo(obsInfo),
    monitor(monitor),
    result(result) {}

NS_IMETHODIMP
TlsExtObserverRunnable::Run() {
    mozilla::MonitorAutoLock lock(monitor); // TODO is this required?
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->observer->OnWriteTlsExtension("test", "ObserverTest", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &promise);
    if (NS_FAILED(rv) || !promise) {
        monitor.Notify();
        return rv;
    }

    RefPtr<TlsExtPromiseHandler> handler = new TlsExtPromiseHandler(monitor, result);
    promise->AppendNativeHandler(handler);

    // monitor.Notify(); // TODO done in the handler?
    return NS_OK;
}
}
