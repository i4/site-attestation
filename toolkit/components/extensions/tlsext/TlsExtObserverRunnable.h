#ifndef mozilla_extensions_TlsExtObserverRunnable_h__
#define mozilla_extensions_TlsExtObserverRunnable_h__

#include "mozilla/Monitor.h"
#include "nsThreadUtils.h"
#include "mozilla/extensions/TlsExtObserverInfo.h"

namespace mozilla::extensions {
class TlsExtObserverRunnable : public mozilla::Runnable {
    public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIRUNNABLE

    TlsExtObserverRunnable(TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor, char*& result);

    private:
    ~TlsExtObserverRunnable() = default;

    TlsExtObserverInfo* obsInfo;
    mozilla::Monitor& monitor;
    char*& result;
};
}

#endif
