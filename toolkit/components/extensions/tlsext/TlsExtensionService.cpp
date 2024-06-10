#include "mozilla/extensions/TlsExtensionService.h"

// #include "mozilla/ClearOnShutdown.h"

#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"

namespace mozilla::extensions {

NS_IMPL_ISUPPORTS(TlsExtensionService, nsITlsExtensionService)

/* static */
already_AddRefed<TlsExtensionService>
TlsExtensionService::GetSingleton() {
  static RefPtr<TlsExtensionService> sSingleton;
  if (!sSingleton) {
    sSingleton = new TlsExtensionService();
    // sSingleton->Init();
    ClearOnShutdown(&sSingleton);
  }
  return do_AddRef(sSingleton);
}

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, nsITlsExtensionService::SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::Hook_SSLExtensionWriter(PRFileDesc * fd, SSLHandshakeType message, unsigned char * data, unsigned int * len, unsigned int maxLen, void * arg, PRBool * _retval) {

    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::Hook_SSLExtensionHandler(PRFileDesc * fd, SSLHandshakeType message, const unsigned char * data, unsigned int len, SSLAlertDescription * alert, void * arg, SECStatus * _retval) {

    return NS_OK;
}

}
