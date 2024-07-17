#ifndef mozilla_extensions_TlsExtObserverRunnable_h__
#define mozilla_extensions_TlsExtObserverRunnable_h__

#include "mozilla/Monitor.h"
#include "nsThreadUtils.h"
#include "mozilla/extensions/TlsExtObserverInfo.h"
#include "prio.h"
#include "ssl.h"
#include "sslt.h"

namespace mozilla::extensions {
class TlsExtObserverRunnable : public mozilla::Runnable {
    protected:
    TlsExtObserverRunnable(PRFileDesc *fd, SSLHandshakeType messageType, TlsExtHookArg* callbackArg,
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor): //char*& result
        mozilla::Runnable("TlsExtObserverRunnable"),
        fd(fd),
        messageType(messageType),
        callbackArg(callbackArg),
        obsInfo(obsInfo),
        monitor(monitor) {};
    ~TlsExtObserverRunnable() = default;
    PRFileDesc *fd;
    SSLHandshakeType messageType;

    TlsExtHookArg* callbackArg;
    TlsExtObserverInfo* obsInfo;
    mozilla::Monitor& monitor;
};

class TlsExtWriterObsRunnable : public TlsExtObserverRunnable {
    public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIRUNNABLE

    TlsExtWriterObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, unsigned int maxLen, TlsExtHookArg* callbackArg,
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        PRUint8* result, unsigned int *resultLen, PRBool* success);

    private:
    ~TlsExtWriterObsRunnable() {};

    unsigned int maxLen;

    PRUint8* result;
    unsigned int* resultLen;
    PRBool* success;
};

class TlsExtHandlerObsRunnable : public TlsExtObserverRunnable {
    public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIRUNNABLE

    TlsExtHandlerObsRunnable(
        PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, TlsExtHookArg* callbackArg,
        TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor,
        SECStatus& result);

    private:
    ~TlsExtHandlerObsRunnable() {};

    const PRUint8 *data;
    unsigned int len;
    SSLAlertDescription *alert;

    SECStatus& result;
};
}

#endif
