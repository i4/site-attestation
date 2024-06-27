#include "mozilla/extensions/TlsExtObserverRunnable.h"
#include "mozilla/extensions/TlsExtPromiseHandler.h"

namespace mozilla::extensions {

extern LazyLogModule gTLSEXTLog;

NS_IMPL_ISUPPORTS(TlsExtWriterObsRunnable, nsIRunnable)
NS_IMPL_ISUPPORTS(TlsExtHandlerObsRunnable, nsIRunnable)

TlsExtWriterObsRunnable::TlsExtWriterObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, unsigned int maxLen, // obsInfo is (callback)arg
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        char*& result):
    TlsExtObserverRunnable(fd, messageType, obsInfo, monitor),
    maxLen(maxLen),
    result(result) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Constructor WriterObsRunnable!\n"));
    }

NS_IMETHODIMP
TlsExtWriterObsRunnable::Run() {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Reached WriterObsRunnable!\n"));

    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->writerObserver->OnWriteTlsExtension(
        obsInfo->extension,
        "sessionID",
        obsInfo->hostname,        // TODO this is wrong
        (nsITlsExtensionObserver::SSLHandshakeType) messageType,
        maxLen,
        &promise);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Call went through!\n"));

    if (NS_FAILED(rv) || !promise) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Failed!\n"));
        mozilla::MonitorAutoLock lock(monitor);
        monitor.Notify();
        return rv;
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Did not fail!\n"));

    // resolve the promise that came back from the web extension
    RefPtr<TlsExtWriterPromiseHandler> handler = new TlsExtWriterPromiseHandler(monitor, result);
    promise->AppendNativeHandler(handler);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Created and Added Promise Handler!\n"));

    // monitor.Notify(); // is done in the handler
    return NS_OK;
}

TlsExtHandlerObsRunnable::TlsExtHandlerObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, // obsInfo is (callback)arg
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        SECStatus& result):
    TlsExtObserverRunnable(fd, messageType, obsInfo, monitor),
    data(data),
    len(len),
    alert(alert),
    result(result) {}

NS_IMETHODIMP
TlsExtHandlerObsRunnable::Run() {
    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->handlerObserver->OnHandleTlsExtension(
        obsInfo->extension,
        "sessionID",
        obsInfo->hostname,  // TODO this is wrong
        (nsITlsExtensionObserver::SSLHandshakeType) messageType,
        (const char*) data,     // TODO C++ style cast
        &promise);

    if (NS_FAILED(rv) || !promise) {
        mozilla::MonitorAutoLock lock(monitor);
        monitor.Notify();
        return rv;
    }

    // resolve the promise that came back from the web extension
    RefPtr<TlsExtHandlerPromiseHandler> handler = new TlsExtHandlerPromiseHandler(monitor, result);
    promise->AppendNativeHandler(handler);

    // monitor.Notify(); is done in the handler
    return NS_OK;
}
}
