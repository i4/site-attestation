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
