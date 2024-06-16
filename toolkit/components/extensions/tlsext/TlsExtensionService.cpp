#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"

namespace mozilla::extensions {

LazyLogModule gTLSEXTLog("tlsext");
using TlsExtObserverInfo = struct TlsExtObserverInfo;

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
    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);
    nsITlsExtensionObserver* obs = obsInfo->observer;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called! [%s]\n", obsInfo->hostname));

    char* dataString;
    if (NS_OK != obs->OnWriteTlsExtension(
        "tlsSessionId",
        obsInfo->hostname,
        (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
        maxLen,
        &dataString)) {
        return PR_FALSE;
    }

    if (dataString == nullptr) return PR_FALSE;

    unsigned int dataLen = strlen(dataString);
    if (dataLen > maxLen) return PR_FALSE;

    strcpy((char*) data, dataString);
    *len = dataLen;

    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);
    nsITlsExtensionObserver* obs = obsInfo->observer;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called! [%s]\n", obsInfo->hostname));

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

SECStatus
TlsExtensionService::InstallObserverHooks(PRFileDesc* sslSock, const char* host) {
    PR_Lock(observersLock);
    auto observersCopy(observers);
    PR_Unlock(observersLock);

    for (const auto& [extension, obsInfo] : observersCopy) {
        if (!std::regex_match(host, *obsInfo->urlPattern)) continue;
        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            onNSS_SSLExtensionWriter, obsInfo,
            onNSS_SSLExtensionHandler, obsInfo)) {
                return SECFailure;
        }
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

std::map<PRUint16, TlsExtensionService::TlsExtObserverInfo*>
TlsExtensionService::GetObservers() { return observers; }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionObserver *observer) {
    auto *obsInfo = new TlsExtObserverInfo {
        .urlPattern = new std::regex(urlPattern),
        .extension = extension,
        .observer = observer,
    };
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
}
