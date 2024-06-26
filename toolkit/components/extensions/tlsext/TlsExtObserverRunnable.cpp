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
    // char* dataString;
    // if (NS_OK != obs->OnWriteTlsExtension(
    //     "tlsSessionId",
    //     obsInfo->hostname,
    //     (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
    //     maxLen,
    //     &dataString)) {
    //         MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("NS not OK\n"));
    //         return PR_FALSE;
    // }

    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->observer->OnWriteTlsExtension(
        "sessionID",
        obsInfo->hostname,
        nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, // TODO get messagetype, maxlen, fd and the rest of the important data into the runnable (via constructor)?
        1000,
        &promise);

    if (NS_FAILED(rv) || !promise) {
        mozilla::MonitorAutoLock lock(monitor);
        monitor.Notify();
        return rv;
    }

    // resolve the promise that came back from the web extension
    RefPtr<TlsExtPromiseHandler> handler = new TlsExtPromiseHandler(monitor, result);
    promise->AppendNativeHandler(handler);

    // monitor.Notify(); is done in the handler
    return NS_OK;
}
}
