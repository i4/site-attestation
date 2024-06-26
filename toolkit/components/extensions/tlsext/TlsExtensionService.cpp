#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/dom/Promise.h"
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

/* static */
PRBool
TlsExtensionService::onNSS_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType messageType, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *callbackArg) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called!\n"));

    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook static cast went through!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook host is known! [%s]\n", obsInfo->hostname));


    // prepare task for main thread
    mozilla::Monitor monitor("ObservableRunnerMonitor");
    char* result = nullptr;
    RefPtr<TlsExtObserverRunnable> obsRun = new TlsExtObserverRunnable(obsInfo, monitor, result);
    NS_DispatchToMainThread(obsRun);

    {
        mozilla::MonitorAutoLock lock(monitor);
        while (!result) { // wait until the result is written
            MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting Loop!\n"));
            monitor.Wait();
        }
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Result came back! [%s]\n", result));

    if (result == nullptr) return PR_FALSE;

    unsigned int dataLen = strlen(result);
    if (dataLen > maxLen) return PR_FALSE;

    strcpy((char*) data, result);
    *len = dataLen;

    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);
    nsITlsExtensionObserver* obs = obsInfo->observer;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook was called! [%s]\n", obsInfo->hostname));

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Observer is [%p]\n", obsInfo->observer));

    nsITlsExtensionObserver::SECStatus secStatus;
    if (NS_OK != obs->OnHandleTlsExtension(
        "tlsSessionId",
        obsInfo->hostname,
        (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
        (const char*) data, // TODO: narrowing conversion, this should be unsigned char* instead of char*
        &secStatus)) {
        return SECSuccess;
    }

    switch (secStatus) {
        case nsITlsExtensionObserver::SECWouldBlock:
            return SECWouldBlock;
        case nsITlsExtensionObserver::SECFailure:
            return SECFailure;
        case nsITlsExtensionObserver::SECSuccess:
            return SECSuccess;
        // default:
            // TODO throw not implemented
    }

    return SECSuccess;
}

TlsExtensionService::TlsExtensionService() {
    observersLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(observersLock);
    // TODO free all Observers, patterns etc
}

SECStatus
TlsExtensionService::InstallObserverHooks(PRFileDesc* sslSock, const char* host) {
    PR_Lock(observersLock);
    auto observersCopy(observers);
    PR_Unlock(observersLock);

    for (const auto& [extension, obsInfo] : observersCopy) {
        if (!std::regex_match(host, *obsInfo->urlPattern)) continue;
        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            onNSS_SSLExtensionWriter, obsInfo,          // TODO: if the Observer only handles or writes, pass nullptr for the other
            onNSS_SSLExtensionHandler, obsInfo)) {
                return SECFailure;
        }
        observersCopy[extension]->hostname = const_cast<char*>(host); // TODO: is this thread safe?
    }

    return SECSuccess;
}

std::map<PRUint16, TlsExtObserverInfo*>
TlsExtensionService::GetObservers() { return observers; }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Observer was added to C++"));

    auto *obsInfo = new TlsExtObserverInfo {
        .urlPattern = new std::regex(urlPattern),
        .extension = extension,
        .observer = observer,
    };
    NS_ADDREF(obsInfo->observer); // TODO this might not be required // TODO: release

    PR_Lock(observersLock);
    observers.insert({extension, obsInfo});
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    observers.erase(extension);
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(observersLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = observers.find(extension);
    *_retval = it != observers.end();
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP   // TODO: remove
TlsExtensionService::CallObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    mozilla::dom::Promise* promise;
    observers[extension]->observer->OnWriteTlsExtension("test", "test", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &promise);
    PR_Unlock(observersLock);
    return NS_OK;
}
}