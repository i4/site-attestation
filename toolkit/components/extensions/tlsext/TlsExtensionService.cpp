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

    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    // auto* arg = static_cast<ExtensionCallbackArg*>(callbackArg);
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook was called!\n"));

    return SECSuccess;
}

// TlsExtensionService::ExtensionCallbackArg::ExtensionCallbackArg(const char* hostname): hostname(strdup(hostname)) {}
// TlsExtensionService::ExtensionCallbackArg::~ExtensionCallbackArg() { free(hostname); }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}
}
