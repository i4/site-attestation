#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/extensions/TlsExtObserverRunnable.h"

namespace mozilla::extensions {

LazyLogModule gTLSEXTLog("tlsext");

NS_IMPL_ISUPPORTS(TlsExtensionService, nsITlsExtensionService)

/* static */
already_AddRefed<TlsExtensionService>
TlsExtensionService::GetSingleton() {
    static RefPtr<TlsExtensionService> singleton;
    if (!singleton) {
        singleton = new TlsExtensionService();
        ClearOnShutdown(&singleton);
    }
    return do_AddRef(singleton);
}

// cleans up a callback arg after a handshake finished
void postHandshakeCleanup(SSLHandshakeType messageType, TlsExtHookArg* callbackArg) {
    if (messageType != SSLHandshakeType::ssl_hs_finished) return;
    // time to clean up
    delete callbackArg;
}

/* static */
PRBool
TlsExtensionService::onNSS_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType messageType, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *callbackArg) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called!\n"));

    auto* hookArg = static_cast<TlsExtHookArg*>(callbackArg);
    auto* obsInfo = hookArg->obsInfo;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook static cast went through!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook host is known! [%s]\n", hookArg->hostName)); // TODO hostname should not written to the struct anymore


    // prepare task for main thread
    mozilla::Monitor monitor("ObservableRunnerMonitor");
    char* result = nullptr;
    RefPtr<TlsExtWriterObsRunnable> obsRun = new TlsExtWriterObsRunnable(
        fd, messageType, maxLen, hookArg,
        obsInfo, monitor,
        result
    );

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Created TlsExtWriterObsRunnable!\n"));

    NS_DispatchToMainThread(obsRun);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Dispatched to main thread!\n"));

    {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Locking!\n"));
        mozilla::MonitorAutoLock lock(monitor);
        // while (!result) { // wait until the result is written   // TODO result = null is meant to be false, there should be a possibility for multiple return values
        //     MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting Loop!\n"));
        //     monitor.Wait();
        // }
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting!\n"));
        monitor.Wait();
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Result came back! [%s]\n", result));

    if (result == nullptr) return PR_FALSE;

    unsigned int dataLen = strlen(result);
    if (dataLen > maxLen) return PR_FALSE;

    strcpy((char*) data, result);
    *len = dataLen;

    postHandshakeCleanup(messageType, hookArg);

    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    auto* hookArg = static_cast<TlsExtHookArg*>(callbackArg);
    auto* obsInfo = hookArg->obsInfo;

    // prepare task for main thread
    mozilla::Monitor monitor("ObservableRunnerMonitor");
    SECStatus result;
    RefPtr<TlsExtHandlerObsRunnable> obsRun = new TlsExtHandlerObsRunnable(
        fd, messageType, data, len, alert, hookArg,
        obsInfo, monitor,
        result
    );
    NS_DispatchToMainThread(obsRun);

    {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Locking!\n"));
        mozilla::MonitorAutoLock lock(monitor);
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting!\n"));
        monitor.Wait();
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("SecStatus: %i\n", result));
    return result; // has to be written by the observer runnable
}

TlsExtensionService::TlsExtensionService() {
    observersLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(observersLock);
}

PRBool noop_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType message, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *arg) {
    return PR_FALSE;
}

SECStatus noop_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *arg) {
    return SECSuccess;
}

SECStatus
TlsExtensionService::InstallObserverHooks(PRFileDesc* sslSock, const char* host) {
    // writers
    PR_Lock(observersLock);
    auto observersCopy(observers);
    PR_Unlock(observersLock);

    for (const auto& [extension, obsInfo] : observersCopy) {
        auto* writerFunc = noop_SSLExtensionWriter;
        auto* handlerFunc = noop_SSLExtensionHandler;

        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Checking regex for extension [%u]!\n", extension));

        if (obsInfo->writerObserver &&
            obsInfo->writerUrlPattern &&
            std::regex_match(host, *obsInfo->writerUrlPattern)) writerFunc = onNSS_SSLExtensionWriter;
        if (obsInfo->handlerObserver &&
            obsInfo->handlerUrlPattern &&
            std::regex_match(host, *obsInfo->handlerUrlPattern)) handlerFunc = onNSS_SSLExtensionHandler;

        // if (writerFunc == noop_SSLExtensionWriter && handlerFunc == noop_SSLExtensionHandler) continue; // TODO should never happen

        // gets freed in postHandshakeCleanup after a handshake finished
        auto* hookArg = new TlsExtHookArg {.obsInfo = obsInfo, .hostName = host};

        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            writerFunc, hookArg,    // TODO simply copy the struct for this
            handlerFunc, hookArg)) {

                MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
                    ("SSL_InstallExtensionHooks failed!\n"));

                return SECStatus::SECFailure;

        }
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Successfully installed observer hooks!\n"));

    return SECStatus::SECSuccess;
}

std::map<PRUint16, TlsExtObserverInfo*>
TlsExtensionService::GetObservers() { return observers; }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

TlsExtObserverInfo*
TlsExtensionService::GetOrCreateObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    auto it = observers.find(extension);
    if (it != observers.end()) {
        // Key exists, return the associated pointer.
        PR_Unlock(observersLock);

        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Found existing obsInfo!\n"));

        return it->second;
    }
    PR_Unlock(observersLock);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Found no existing obsInfo!\n"));

    // gets freed in RemoveObserver
    return new TlsExtObserverInfo(extension);
}

NS_IMETHODIMP
TlsExtensionService::AddWriterObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionWriterObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer-Observer was added to C++"));
    NS_ADDREF(observer);

    auto* obsInfo = GetOrCreateObserver(extension);
    obsInfo->writerUrlPattern = new std::regex(urlPattern);     // gets freed in RemoveObserver
    obsInfo->writerObserver = observer;

    PR_Lock(observersLock);
    observers.insert({extension, obsInfo});
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddHandlerObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionHandlerObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler-Observer was added to C++"));
    NS_ADDREF(observer);

    auto* obsInfo = GetOrCreateObserver(extension);
    obsInfo->handlerUrlPattern = new std::regex(urlPattern);    // gets freed in RemoveObserver
    obsInfo->handlerObserver = observer;

    PR_Lock(observersLock);
    observers.insert({extension, obsInfo});
    PR_Unlock(observersLock);
    return NS_OK;
}

void
TlsExtensionService::RemoveObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    auto* obsInfo = observers[extension];
    if (obsInfo->writerObserver == nullptr && obsInfo->handlerObserver == nullptr) {
        // free up any storage associated with the observer
        delete obsInfo->writerUrlPattern;
        delete obsInfo->handlerUrlPattern;
        delete obsInfo;
        observers.erase(extension);
    }
    PR_Unlock(observersLock);
}

NS_IMETHODIMP
TlsExtensionService::RemoveWriterObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    observers[extension]->writerObserver = nullptr;
    PR_Unlock(observersLock);
    RemoveObserver(extension);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveHandlerObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    observers[extension]->handlerObserver = nullptr;
    PR_Unlock(observersLock);
    RemoveObserver(extension);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasWriterObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(observersLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = observers.find(extension);
    *_retval = it != observers.end() && it->second->writerObserver;
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasHandlerObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(observersLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = observers.find(extension);
    *_retval = it != observers.end() && it->second->handlerObserver;
    PR_Unlock(observersLock);
    return NS_OK;
}
}