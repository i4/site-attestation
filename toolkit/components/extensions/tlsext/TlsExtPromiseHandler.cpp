#include "mozilla/extensions/TlsExtPromiseHandler.h"

namespace mozilla::extensions {
NS_IMPL_ISUPPORTS(TlsExtPromiseHandler, nsISupports)

TlsExtPromiseHandler::TlsExtPromiseHandler(mozilla::Monitor& monitor, char*& result): monitor(monitor), result(result) {
}

void
TlsExtPromiseHandler::ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    if (aValue.isString()) {
        nsAutoJSString jsString;
        if (jsString.init(aCx, aValue.toString())) {
            result = ToNewCString(jsString);
        }
    }
    Notify();
}

void
TlsExtPromiseHandler::RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) {
    result = nullptr; // TODO Handle rejection as needed
    Notify();
}

void
TlsExtPromiseHandler::Notify() {
    mozilla::MonitorAutoLock lock(monitor);
    monitor.Notify();
}
}
