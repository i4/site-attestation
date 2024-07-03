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

TlsExtWriterPromiseHandler::TlsExtWriterPromiseHandler(mozilla::Monitor& monitor, char*& result):
    TlsExtPromiseHandler(monitor), result(result) {}

void
TlsExtWriterPromiseHandler::ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Reached Resolved Callback!\n"));

    if (aValue.isString()) {
        nsAutoJSString jsString;
        if (jsString.init(aCx, aValue.toString())) {
            result = ToNewCString(jsString); // needs to be freed
        }
    } else {
        result = nullptr;
    }
    Notify();
}

void
TlsExtWriterPromiseHandler::RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    result = nullptr; // TODO Handle rejection as needed
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
