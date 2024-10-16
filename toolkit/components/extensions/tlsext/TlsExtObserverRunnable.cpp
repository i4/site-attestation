#include "mozilla/extensions/TlsExtObserverRunnable.h"
#include "mozilla/extensions/TlsExtPromiseHandler.h"

namespace mozilla::extensions {

extern LazyLogModule gTLSEXTLog;

NS_IMPL_ISUPPORTS(TlsExtWriterObsRunnable, nsIRunnable)
NS_IMPL_ISUPPORTS(TlsExtHandlerObsRunnable, nsIRunnable)

std::string PtrToStr(const void* ptr) {
    std::stringstream s;
    s << ptr;
    return s.str();
}

TlsExtWriterObsRunnable::TlsExtWriterObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, unsigned int maxLen, TlsExtHookArg* callbackArg,
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        PRUint8* result, unsigned int *resultLen, PRBool* success):
    TlsExtObserverRunnable(fd, messageType, callbackArg, obsInfo, monitor),
    maxLen(maxLen),
    result(result),
    resultLen(resultLen),
    success(success) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Constructor WriterObsRunnable!\n"));
    }

NS_IMETHODIMP
TlsExtWriterObsRunnable::Run() {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Reached WriterObsRunnable!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("ID is: %s\n", PtrToStr(fd).c_str()));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("CallbackArg is: %p\n", callbackArg));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Hostname is: %s\n", callbackArg->hostName));

    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->writerObserver->OnWriteTlsExtension(
        obsInfo->extension,
        PtrToStr(fd).c_str(),   // TODO does this leak?
        callbackArg->hostName,
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
    RefPtr<TlsExtWriterPromiseHandler> handler = new TlsExtWriterPromiseHandler(monitor, result, resultLen, maxLen, success);
    promise->AppendNativeHandler(handler);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Created and Added Promise Handler!\n"));

    // monitor.Notify(); // is done in the handler
    return NS_OK;
}

TlsExtHandlerObsRunnable::TlsExtHandlerObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, TlsExtHookArg* callbackArg,
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        SECStatus& result):
    TlsExtObserverRunnable(fd, messageType, callbackArg, obsInfo, monitor),
    data(data),
    len(len),
    alert(alert),
    result(result) {}

NS_IMETHODIMP
TlsExtHandlerObsRunnable::Run() {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Actual Len [%u]!\n", len));

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Actual Data [%s]!\n", data));

    // convert unsigned char* to AString
    nsString jsString;
    // jsString.Assign(reinterpret_cast<const char16_t*>(data), len / 2);
    jsString.AssignASCII(reinterpret_cast<const char*>(data), len);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Binary String Len [%zu]!\n", jsString.Length()));

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Converted Data [%s]!\n", jsString.get()));

    // run the actual callback
    mozilla::dom::Promise* promise;
    nsresult rv = obsInfo->handlerObserver->OnHandleTlsExtension(
        obsInfo->extension,
        PtrToStr(fd).c_str(),   // TODO does this leak?
        callbackArg->hostName,
        (nsITlsExtensionObserver::SSLHandshakeType) messageType,
        jsString,     // TODO C++ style cast
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
