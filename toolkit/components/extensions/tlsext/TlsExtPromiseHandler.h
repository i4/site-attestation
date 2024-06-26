#ifndef mozilla_extensions_TlsExtPromiseHandler_h__
#define mozilla_extensions_TlsExtPromiseHandler_h__

#include "mozilla/Monitor.h"
#include "mozilla/dom/Promise.h"
#include "mozilla/dom/PromiseNativeHandler.h"

namespace mozilla::extensions {
class TlsExtPromiseHandler final : public mozilla::dom::PromiseNativeHandler {
    public:
    NS_DECL_ISUPPORTS

    TlsExtPromiseHandler(mozilla::Monitor& monitor, char*& result);

    void ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) override;
    void RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) override;

    private:
    ~TlsExtPromiseHandler() = default;
    void Notify();
    mozilla::Monitor& monitor;
    char*& result;
};
}

#endif
