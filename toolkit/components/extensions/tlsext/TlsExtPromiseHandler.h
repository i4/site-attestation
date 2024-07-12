#ifndef mozilla_extensions_TlsExtPromiseHandler_h__
#define mozilla_extensions_TlsExtPromiseHandler_h__

#include "mozilla/Monitor.h"
#include "mozilla/dom/Promise.h"
#include "mozilla/dom/PromiseNativeHandler.h"
#include "seccomon.h"

namespace mozilla::extensions {
class TlsExtPromiseHandler : public mozilla::dom::PromiseNativeHandler {
    public:
    NS_DECL_ISUPPORTS

    TlsExtPromiseHandler(mozilla::Monitor& monitor): monitor(monitor) {};

    virtual void ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) override = 0;
    virtual void RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv) override = 0;

    protected:
    ~TlsExtPromiseHandler() = default;
    void Notify();
    mozilla::Monitor& monitor;
};

class TlsExtWriterPromiseHandler : public TlsExtPromiseHandler {
    public:
    TlsExtWriterPromiseHandler(mozilla::Monitor& monitor, PRUint8* result, unsigned int* resultLen, unsigned int maxLen, PRBool* success);

    void ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv);
    void RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv);

    private:
    PRUint8* result;
    unsigned int* resultLen;
    unsigned int maxLen;
    PRBool* success;
};

class TlsExtHandlerPromiseHandler : public TlsExtPromiseHandler {
    public:
    TlsExtHandlerPromiseHandler(mozilla::Monitor& monitor, SECStatus& result);

    void ResolvedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv);
    void RejectedCallback(JSContext* aCx, JS::Handle<JS::Value> aValue, mozilla::ErrorResult& aRv);

    private:
    SECStatus& result;
};
}

#endif
