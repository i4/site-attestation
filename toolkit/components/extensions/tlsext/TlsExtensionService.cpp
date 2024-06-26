#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/extensions/TlsExtObserverRunnable.h"

namespace mozilla::extensions {

LazyLogModule gTLSEXTLog("tlsext");

NS_IMPL_ISUPPORTS(TlsExtensionService, nsITlsExtensionService)

/* static */
already_AddRefed<TlsExtensionService>
TlsExtensionService::GetSingleton() {
    static RefPtr<TlsExtensionService> singleton;
    if (!singleton) {
        singleton = new TlsExtensionService();
        ClearOnShutdown(&singleton);
    }
    return do_AddRef(singleton);
}

/* static */
PRBool
TlsExtensionService::onNSS_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType messageType, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *callbackArg) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook was called!\n"));

    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook static cast went through!\n"));

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook host is known! [%s]\n", obsInfo->hostname));


    // prepare task for main thread
    mozilla::Monitor monitor("ObservableRunnerMonitor");
    char* result = nullptr;
    // RefPtr<TlsExtWriterObsRunnable> obsRun = new TlsExtWriterObsRunnable(
    //     fd, messageType, maxLen,
    //     obsInfo, monitor,
    //     result
    // );

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Created TlsExtWriterObsRunnable!\n"));

    // NS_DispatchToMainThread(obsRun);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Dispatched to main thread!\n"));

    // {
    //     MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Locking!\n"));
    //     mozilla::MonitorAutoLock lock(monitor);
    //     while (!result) { // wait until the result is written   // TODO result = null is meant to be false
    //         MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting Loop!\n"));
    //         // monitor.Wait();
    //     }
    // }

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Result came back! [%s]\n", result));

    // if (result == nullptr) return PR_FALSE;

    // unsigned int dataLen = strlen(result);
    // if (dataLen > maxLen) return PR_FALSE;

    // strcpy((char*) data, result);
    // *len = dataLen;

    return PR_TRUE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    // auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);
    // nsITlsExtensionObserver* obs = obsInfo->observer;

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Handler Hook was called! [%s]\n", obsInfo->hostname));

    // // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    // //         ("Observer is [%p]\n", obsInfo->observer));

    // nsITlsExtensionObserver::SECStatus secStatus;
    // if (NS_OK != obs->OnHandleTlsExtension(
    //     "tlsSessionId",
    //     obsInfo->hostname,
    //     (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
    //     (const char*) data, // TODO: narrowing conversion, this should be unsigned char* instead of char*
    //     &secStatus)) {
    //     return SECSuccess;
    // }

    // switch (secStatus) {
    //     case nsITlsExtensionObserver::SECWouldBlock:
    //         return SECWouldBlock;
    //     case nsITlsExtensionObserver::SECFailure:
    //         return SECFailure;
    //     case nsITlsExtensionObserver::SECSuccess:
    //         return SECSuccess;
    //     // default:
    //         // TODO throw not implemented
    // }

    return SECSuccess;
}

TlsExtensionService::TlsExtensionService() {
    writerLock = PR_NewLock();
    handlerLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(writerLock);
    PR_DestroyLock(handlerLock);
    // TODO free all Observers, patterns etc
}

PRBool noop_SSLExtensionWriter(PRFileDesc *fd, SSLHandshakeType message, PRUint8 *data, unsigned int *len, unsigned int maxLen, void *arg) {
    return PR_FALSE;
}

SECStatus noop_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *arg) {
    return SECSuccess;
}

SECStatus
TlsExtensionService::InstallObserverHooks(PRFileDesc* sslSock, const char* host) {
    // writers
    PR_Lock(writerLock);
    auto writersCopy(writerObservers);
    PR_Unlock(writerLock);

    for (const auto& [extension, obsInfo] : writersCopy) {
        if (!std::regex_match(host, *obsInfo->urlPattern)) continue;
        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            onNSS_SSLExtensionWriter, obsInfo,
            noop_SSLExtensionHandler, nullptr)) {
                MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
                    ("SSL_InstallExtensionHooks for writers failed!\n"));
                return SECFailure;

        }
        obsInfo->hostname = const_cast<char*>(host); // TODO: is this thread safe?
    }

    // handlers
    PR_Lock(handlerLock);
    auto handlersCopy(handlerObservers);
    PR_Unlock(handlerLock);

    for (const auto& [extension, obsInfo] : handlersCopy) {
        if (!std::regex_match(host, *obsInfo->urlPattern)) continue;
        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            noop_SSLExtensionWriter, nullptr,
            onNSS_SSLExtensionHandler, obsInfo)) {
                MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
                    ("SSL_InstallExtensionHooks for handlers failed!\n"));
                return SECFailure;
        }
        obsInfo->hostname = const_cast<char*>(host); // TODO: is this thread safe?
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Successfully installed observer hooks!\n"));

    return SECSuccess;
}

std::map<PRUint16, TlsExtObserverInfo*>
TlsExtensionService::GetObservers() { return observers; }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddWriterObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionWriterObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer-Observer was added to C++"));

    auto *obsInfo = new TlsExtObserverInfo {
        .urlPattern = new std::regex(urlPattern),
        .extension = extension,
        .observer = observer,
    };
    NS_ADDREF(obsInfo->observer); // TODO this might not be required // TODO: release

    PR_Lock(writerLock);
    writerObservers.insert({extension, obsInfo});
    PR_Unlock(writerLock);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer-Observer successfully inserted"));

    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddHandlerObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionHandlerObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler-Observer was added to C++"));

    auto *obsInfo = new TlsExtObserverInfo {
        .urlPattern = new std::regex(urlPattern),
        .extension = extension,
        .observer = observer,
    };
    NS_ADDREF(obsInfo->observer); // TODO this might not be required // TODO: release

    PR_Lock(handlerLock);
    handlerObservers.insert({extension, obsInfo});
    PR_Unlock(handlerLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveWriterObserver(PRUint16 extension) {
    PR_Lock(writerLock);
    writerObservers.erase(extension);
    PR_Unlock(writerLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveHandlerObserver(PRUint16 extension) {
    PR_Lock(handlerLock);
    handlerObservers.erase(extension);
    PR_Unlock(handlerLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasWriterObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(writerLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = writerObservers.find(extension);
    *_retval = it != writerObservers.end();
    PR_Unlock(writerLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasHandlerObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(handlerLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = handlerObservers.find(extension);
    *_retval = it != handlerObservers.end();
    PR_Unlock(handlerLock);
    return NS_OK;
}

// NS_IMETHODIMP   // TODO: remove // TODO will never work since its on the same thread
// TlsExtensionService::CallWriterObserver(PRUint16 extension) {
//     // PR_Lock(writerLock);
//     // mozilla::dom::Promise* promise;
//     // writerObservers[extension]->observer->OnWriteTlsExtension("test", "test", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &promise);

//     auto* obsInfo = writerObservers[extension];
//     // PR_Unlock(writerLock);

//     // prepare task for main thread
//     mozilla::Monitor monitor("ObservableRunnerMonitor");
//     char* result = nullptr;
//     RefPtr<TlsExtWriterObsRunnable> obsRun = new TlsExtWriterObsRunnable(
//         nullptr, SSLHandshakeType::ssl_hs_client_hello, 1000,
//         obsInfo, monitor,
//         result
//     );

//     MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
//             ("Created TlsExtWriterObsRunnable!\n"));

//     nsresult rv = NS_DispatchToMainThread(obsRun);
//     if (NS_FAILED(rv)) {
//         MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
//             ("Dispatch failed!\n"));
//         return rv;
//     }

//     MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
//             ("Dispatched to main thread!\n"));

//     {
//         mozilla::MonitorAutoLock lock(monitor);
//         while (!result) { // wait until the result is written
//             MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting Loop!\n"));
//             monitor.Wait();
//         }
//     }

//     MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
//             ("Result came back! [%s]\n", result));
//     return NS_OK;
// }
}