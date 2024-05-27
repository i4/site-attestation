#include "mozilla/extensions/TlsExtensionService.h"

// #include "mozilla/ClearOnShutdown.h"

#include "sslexp.h"

namespace mozilla::extensions {

NS_IMPL_ISUPPORTS(TlsExtensionService, nsITlsExtensionService)

// /* static */
// already_AddRefed<TlsExtensionService>
// TlsExtensionService::GetSingleton() {
//   static RefPtr<TlsExtensionService> sSingleton;
//   if (!sSingleton) {
//     sSingleton = new TlsExtensionService();
//     // sSingleton->Init();
//     ClearOnShutdown(&sSingleton);
//   }
//   return do_AddRef(sSingleton);
// }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, nsITlsExtensionService::SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

}
