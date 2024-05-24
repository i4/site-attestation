#include "mozilla/extensions/TlsExtensionService.h"

#include "sslexp.h"

namespace mozilla::extensions {

NS_IMPL_ISUPPORTS(TlsExtensionService, nsITlsExtensionService)

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, nsITlsExtensionService::SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

}
