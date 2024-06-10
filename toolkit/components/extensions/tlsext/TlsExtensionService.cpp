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

// TODO: rework these bridge methods
/* static */
PRBool
TlsExtensionService::callback_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType messageType, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *arg) {
    PRBool retval;
    GetSingleton().take()->Hook_SSLExtensionWriter(fd, messageType, data, len, maxLen, arg, &retval);
    return retval;
}

/* static */
SECStatus
TlsExtensionService::callback_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *arg) {
    SECStatus retval;
    GetSingleton().take()->Hook_SSLExtensionHandler(fd, messageType, data, len, alert, arg, &retval);
    return retval;
}

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::Hook_SSLExtensionWriter(PRFileDesc * fd, SSLHandshakeType message, unsigned char * data, unsigned int * len, unsigned int maxLen, void * arg, PRBool * _retval) {
    char* host = (char*) arg;
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called! [%s]\n", host));
    free(host);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::Hook_SSLExtensionHandler(PRFileDesc * fd, SSLHandshakeType message, const unsigned char * data, unsigned int len, SSLAlertDescription * alert, void * arg, SECStatus * _retval) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook was called!\n"));

    return NS_OK;
}

}
