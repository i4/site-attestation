#ifndef mozilla_extensions_TlsAuthCertificateObserverInfo_h__
#define mozilla_extensions_TlsAuthCertificateObserverInfo_h__

#include <regex>
#include <utility>

#include "nsCOMPtr.h"
#include "nsITlsExtensionService.h"

namespace mozilla::extensions {
struct TlsAuthCertificateObserverInfo {
    TlsAuthCertificateObserverInfo(std::regex* pattern, nsCOMPtr<nsITlsAuthCertificateObserver> observer): pattern(pattern), observer(std::move(observer)) {}

    std::regex* pattern;
    nsCOMPtr<nsITlsAuthCertificateObserver> observer;
};
}

#endif
