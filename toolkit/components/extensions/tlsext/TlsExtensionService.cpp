#include "mozilla/extensions/TlsExtensionService.h"

// #include "mozilla/ClearOnShutdown.h"

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
TlsExtensionService::onNSS_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType messageType, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *arg) {
    char* host = (char*) arg;
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called! [%s]\n", host));
    free(host);
    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *arg) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook was called!\n"));

    return SECSuccess;
}

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::GetDefaultExtension(PRUint16 *aDefaultExtension) {
    *aDefaultExtension = defaultExtension;
    return NS_OK;
}
}
