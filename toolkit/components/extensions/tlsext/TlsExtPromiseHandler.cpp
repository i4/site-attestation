#include "mozilla/extensions/TlsExtPromiseHandler.h"

namespace mozilla::extensions {

extern LazyLogModule gTLSEXTLog;

NS_IMPL_ISUPPORTS(TlsExtPromiseHandler, nsISupports)
// NS_IMPL_ISUPPORTS(TlsExtWriterPromiseHandler, nsISupports)
// NS_IMPL_ISUPPORTS(TlsExtHandlerPromiseHandler, nsISupports)

void
TlsExtPromiseHandler::Notify() {
    mozilla::MonitorAutoLock lock(monitor);
    monitor.Notify();
}

TlsExtWriterPromiseHandler::TlsExtWriterPromiseHandler(mozilla::Monitor& monitor, PRUint8* result, unsigned int *resultLen, unsigned int maxLen, PRBool* success):
    TlsExtPromiseHandler(monitor), result(result), resultLen(resultLen), maxLen(maxLen), success(success) {}

void
TlsExtWriterPromiseHandler::ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Reached Resolved Callback!\n"));

    *success = PR_FALSE;

    nsAutoJSString jsString;
    if (aValue.isString() && jsString.init(aCx, aValue.toString())) {
        MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Is jsString!\n"));
        if (jsString.Length() + 1 <= maxLen) { // +1 for \0
            MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("fits maxlen!\n"));

            for (size_t i = 0; i < jsString.Length(); ++i) {
                result[i] = static_cast<PRUint8>(jsString[i]);
            }
            result[jsString.Length()] = '\0';

            // *resultLen = static_cast<unsigned int>(jsString.Length()) / 2; // convert UTF 16 to UTF 8 // TODO does this work or are characters skipped?
            *resultLen = jsString.Length();
            *success = PR_TRUE;
            MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("set success!\n"));
        }
    }

    Notify();
}



void
TlsExtWriterPromiseHandler::RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    success = PR_FALSE;
    Notify();
}

TlsExtHandlerPromiseHandler::TlsExtHandlerPromiseHandler(mozilla::Monitor& monitor, SECStatus& result):
    TlsExtPromiseHandler(monitor), result(result) {}

void
TlsExtHandlerPromiseHandler::ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    if (aValue.isNumber()) {
        auto number = aValue.toNumber();
        result = static_cast<SECStatus>(number);
    } else {
        result = SECSuccess;
    }
    Notify();
}

void
TlsExtHandlerPromiseHandler::RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    result = SECSuccess; // TODO Handle rejection as needed
    Notify();
}
}
