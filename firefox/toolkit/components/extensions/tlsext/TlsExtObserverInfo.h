#ifndef mozilla_extensions_TlsExtOserverInfo_h__
#define mozilla_extensions_TlsExtOserverInfo_h__

#include <regex>

#include "nsCOMPtr.h"
#include "nsITlsExtensionService.h"
#include "prtypes.h"

namespace mozilla::extensions {
struct TlsExtObserverInfo {
    TlsExtObserverInfo(PRUint16 extension): writerUrlPattern(nullptr), handlerUrlPattern(nullptr), extension(extension), writerObserver(nullptr), handlerObserver(nullptr) {}

    std::regex* writerUrlPattern;
    std::regex* handlerUrlPattern;
    PRUint16 extension;
    nsCOMPtr<nsITlsExtensionWriterObserver> writerObserver;
    nsCOMPtr<nsITlsExtensionHandlerObserver> handlerObserver;
};

struct TlsExtHookArg {
    TlsExtObserverInfo* obsInfo{};
    const char* hostName{};
};
}

#endif
