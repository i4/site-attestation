#ifndef mozilla_extensions_TlsExtOserverInfo_h__
#define mozilla_extensions_TlsExtOserverInfo_h__

#include <regex>

#include "nsCOMPtr.h"
#include "nsITlsExtensionService.h"
#include "prtypes.h"

namespace mozilla::extensions {
struct TlsExtObserverInfo {
    std::regex* urlPattern;
    PRUint16 extension;
    nsCOMPtr<nsITlsExtensionObserver> observer;
    char* hostname;
};
}

#endif
