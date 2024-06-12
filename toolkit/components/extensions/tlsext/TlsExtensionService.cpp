#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"

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
    // auto* arg = static_cast<ExtensionCallbackArg*>(callbackArg);
    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Writer Hook was called! [%s]\n", SSL_RevealURL(fd)));
    // SSL_GetSessionID(fd);
    GetSingleton().take()->callWriterObservers(fd, messageType, data, len, maxLen, callbackArg);
    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    // auto* arg = static_cast<ExtensionCallbackArg*>(callbackArg);
    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Handler Hook was called!\n"));
    GetSingleton().take()->callHandlerObservers(fd, messageType, data, len, alert, callbackArg);
    return SECSuccess;
}

// TlsExtensionService::ExtensionCallbackArg::ExtensionCallbackArg(const char* hostname): hostname(strdup(hostname)) {}
// TlsExtensionService::ExtensionCallbackArg::~ExtensionCallbackArg() { free(hostname); }

TlsExtensionService::TlsExtensionService() {
    observersLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(observersLock);
}

// TODO: overthink the lock, is it required? (Since race conditions are basically irrelevant)

PRBool
TlsExtensionService::callWriterObservers(PRFileDesc *fd,
        SSLHandshakeType messageType,
        PRUint8 *data,
        unsigned int *len,
        unsigned int maxLen,
        void *callbackArg) {

    PR_Lock(observersLock);
    for (auto const& o : observers) {
        char* dataString;
        auto obsRet = o->OnWriteTlsExtension("id", "url", (nsITlsExtensionObserver::SSLHandshakeType) messageType, maxLen, &dataString);
        if (obsRet != NS_OK) continue;

        unsigned int dataLen = strlen(dataString);
        if (dataLen > maxLen) continue;

        strcpy((char*) data, dataString);
        *len = dataLen;
        return PR_TRUE;
    }
    PR_Unlock(observersLock);

    return PR_FALSE;
}

SECStatus
TlsExtensionService::callHandlerObservers(PRFileDesc *fd,
        SSLHandshakeType messageType,
        const PRUint8 *data,
        unsigned int len,
        SSLAlertDescription *alert,
        void *callbackArg) {
    PR_Lock(observersLock);
    for (auto const& o : observers) {

    }
    PR_Unlock(observersLock);
    return SECSuccess;
}

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddObserver(nsITlsExtensionObserver *observer) {
    PR_Lock(observersLock);
    observers.push_front(observer);
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveObserver(nsITlsExtensionObserver *observer, bool *_retval) {
    PR_Lock(observersLock);
    observers.remove(observer);
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasObserver(nsITlsExtensionObserver *observer, bool *_retval) {
    PR_Lock(observersLock);
    *_retval = std::find(observers.begin(), observers.end(), observer) != observers.end();
    PR_Unlock(observersLock);
    return NS_OK;
}
}
