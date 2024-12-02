#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "mozilla/extensions/TlsAuthCertObserverRunnable.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/extensions/TlsExtObserverRunnable.h"
#include "mozilla/extensions/TlsExtUtil.h"

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
            ("[%p] Writer Hook was called!\n", fd));

    auto* hookArg = static_cast<TlsExtHookArg*>(callbackArg);
    auto* obsInfo = hookArg->obsInfo;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook static cast went through!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook host is known! [%s]\n", hookArg->hostName));


    // prepare task for main thread
    mozilla::Monitor monitor("ObservableRunnerMonitor");
    PRBool success = PR_FALSE;
    RefPtr<TlsExtWriterObsRunnable> obsRun = new TlsExtWriterObsRunnable(
        fd, messageType, maxLen, hookArg,
        obsInfo, monitor,
        data, len, &success
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
            ("Result came back! [%s] len: [%i]\n", data, *len));

    postHandshakeCleanup(messageType, hookArg);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Return success [%i]\n", success));

    return success;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] Handler Hook was called!\n", fd));
    auto* hookArg = static_cast<TlsExtHookArg*>(callbackArg);
    auto* obsInfo = hookArg->obsInfo;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook static cast went through!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook host is known! [%s]\n", hookArg->hostName));

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

/* static */
SECStatus
TlsExtensionService::onNSS_SSLAuthCertificate(PRFileDesc *fd) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] onNSS_SSLAuthCertificate was called!\n", fd));

    auto* tlsExtensionService = mozilla::extensions::TlsExtensionService::GetSingleton().take();

    PR_Lock(tlsExtensionService->authCertObserversLock);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%zu] size of map\n", tlsExtensionService->authCertObservers.size()));

    std::map<PRFileDesc*, nsCOMPtr<nsITlsAuthCertificateObserver>>::iterator it = tlsExtensionService->authCertObservers.find(fd);
    if (it == tlsExtensionService->authCertObservers.end()) {
        // no observer registered for the socket 'fd'
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] no observer registered for the socket\n", fd));

        PR_Unlock(tlsExtensionService->authCertObserversLock);
        return SECSuccess;
    }
    PR_Unlock(tlsExtensionService->authCertObserversLock);
    // 'it->second' is the observer to be called

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Creating monitor\n"));
    mozilla::Monitor monitor("AuthCertObservableRunnerMonitor");
    SECStatus result;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Creating runnable\n"));
    RefPtr<TlsAuthCertObsRunnable> obsRun = new TlsAuthCertObsRunnable(fd, it->second, monitor, result);
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] dispatching TlsAuthCertObsRunnable\n", fd));

    NS_DispatchToMainThread(obsRun);

    {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Locking!\n"));
        mozilla::MonitorAutoLock lock(monitor);
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting!\n"));
        monitor.Wait();
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] Removing AuthCert Observer\n", fd));
    // tlsExtensionService->RemoveAuthCertificateObserver(fd); // TODO: check for existance?

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("SSLAuthCert SecStatus: %i\n", result));

    tlsExtensionService->Release();
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("released tlsExtServ"));
    return result;
}

TlsExtensionService::TlsExtensionService() {
    observersLock = PR_NewLock();
    authCertObserversLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(observersLock);
    PR_DestroyLock(authCertObserversLock);
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
    observers[extension]->writerObserver->Release();
    observers[extension]->writerObserver = nullptr;
    PR_Unlock(observersLock);
    RemoveObserver(extension);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveHandlerObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    observers[extension]->handlerObserver->Release();
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

NS_IMETHODIMP
TlsExtensionService::AddAuthCertificateObserver(const char * tlsSessionId, nsITlsAuthCertificateObserver* observer) {
    NS_ADDREF(observer);

    PRFileDesc* fd = (PRFileDesc*) TlsExtUtil::StrToPtr(tlsSessionId);
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("[%p] AddAuthCertificateObserver\n", fd));

    PR_Lock(authCertObserversLock);
    authCertObservers.insert({fd, observer});
    PR_Unlock(authCertObserversLock);
    return NS_OK;
}

void
TlsExtensionService::RemoveAuthCertificateObserver(PRFileDesc* fd) {
    PR_Lock(authCertObserversLock);
    authCertObservers[fd]->Release();
    authCertObservers.erase(fd);
    PR_Unlock(authCertObserversLock);
}

NS_IMETHODIMP
TlsExtensionService::RemoveAuthCertificateObserver(const char * tlsSessionId) {
    bool hasObserver;
    HasAuthCertificateObserver(tlsSessionId, &hasObserver);
    if (!hasObserver) return NS_OK;

    PRFileDesc* fd = (PRFileDesc*) TlsExtUtil::StrToPtr(tlsSessionId);
    RemoveAuthCertificateObserver(fd);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasAuthCertificateObserver(const char * tlsSessionId, bool *_retval) {
    PRFileDesc* fd = (PRFileDesc*) TlsExtUtil::StrToPtr(tlsSessionId);
    PR_Lock(authCertObserversLock);
    std::map<PRFileDesc*, nsCOMPtr<nsITlsAuthCertificateObserver>>::iterator it = authCertObservers.find(fd);
    *_retval = it != authCertObservers.end();
    PR_Unlock(authCertObserversLock);
    return NS_OK;
}
}