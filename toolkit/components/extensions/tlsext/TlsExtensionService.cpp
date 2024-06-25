#include "mozilla/extensions/TlsExtensionService.h"

#include "mozilla/Logging.h"
#include "sslexp.h"
#include "mozilla/ClearOnShutdown.h"

namespace mozilla::extensions {

LazyLogModule gTLSEXTLog("tlsext");
using TlsExtObserverInfo = struct TlsExtObserverInfo;

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

    // nsCOMPtr<nsITlsExtensionObserver> obs = obsInfo->observer;

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Writer Hook ncCOMPtr went through!\n"));

    // TODO: liegt es an den casts dass es crasht? Probieren sie zu entfernen und dann mit CallObservers probieren

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Writer Hook host is known! [%s]\n", obsInfo->hostname));

    mozilla::Monitor monitor("ObservableRunnerMonitor");
    char* result = nullptr; // TODO this might need to be a doubke pointer
    RefPtr<ObserverRunnable> obsRun = new ObserverRunnable(obsInfo, monitor, result);
    NS_DispatchToMainThread(obsRun); // TODO

    {
        mozilla::MonitorAutoLock lock(monitor);
        while (!result) { // wait until the result is written
            MOZ_LOG(gTLSEXTLog, LogLevel::Debug, ("Waiting Loop!\n"));
            monitor.Wait();
        }
    }

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Result came back! [%s]\n", result));


    // auto* tlsExtensionService = mozilla::extensions::TlsExtensionService::GetSingleton().take();
    // tlsExtensionService->CallObserver(420);

    // char* test;
    // obsInfo->observer->OnWriteTlsExtension("test", "test", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &test);

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Observer is [%p]\n", obsInfo->observer));

    // char* dataString;
    // if (NS_OK != obs->OnWriteTlsExtension(
    //     "tlsSessionId",
    //     obsInfo->hostname,
    //     (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
    //     maxLen,
    //     &dataString)) {
    //         MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("NS not OK\n"));
    //         return PR_FALSE;
    // }

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("NS OK\n"));

    // if (dataString == nullptr) return PR_FALSE;

    // unsigned int dataLen = strlen(dataString);
    // if (dataLen > maxLen) return PR_FALSE;

    // strcpy((char*) data, dataString);
    // *len = dataLen;

    // return PR_TRUE;]
    return PR_FALSE;
}

/* static */
SECStatus
TlsExtensionService::onNSS_SSLExtensionHandler(PRFileDesc *fd, SSLHandshakeType messageType, const PRUint8 *data, unsigned int len, SSLAlertDescription *alert, void *callbackArg) {
    auto* obsInfo = static_cast<TlsExtObserverInfo*>(callbackArg);
    nsITlsExtensionObserver* obs = obsInfo->observer;

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Handler Hook was called! [%s]\n", obsInfo->hostname));

    // MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
    //         ("Observer is [%p]\n", obsInfo->observer));

    nsITlsExtensionObserver::SECStatus secStatus;
    if (NS_OK != obs->OnHandleTlsExtension(
        "tlsSessionId",
        obsInfo->hostname,
        (nsITlsExtensionObserver::SSLHandshakeType) messageType, // this cast is legal, because the enum has the same structure
        (const char*) data, // TODO: narrowing conversion, this should be unsigned char* instead of char*
        &secStatus)) {
        return SECSuccess;
    }

    switch (secStatus) {
        case nsITlsExtensionObserver::SECWouldBlock:
            return SECWouldBlock;
        case nsITlsExtensionObserver::SECFailure:
            return SECFailure;
        case nsITlsExtensionObserver::SECSuccess:
            return SECSuccess;
        // default:
            // TODO throw not implemented
    }

    return SECSuccess;
}

SECStatus
TlsExtensionService::InstallObserverHooks(PRFileDesc* sslSock, const char* host) {
    PR_Lock(observersLock);
    auto observersCopy(observers);
    PR_Unlock(observersLock);

    for (const auto& [extension, obsInfo] : observersCopy) {
        if (!std::regex_match(host, *obsInfo->urlPattern)) continue;
        if (SECSuccess != SSL_InstallExtensionHooks(
            sslSock, extension,
            onNSS_SSLExtensionWriter, obsInfo,
            onNSS_SSLExtensionHandler, obsInfo)) {
                return SECFailure;
        }
        observers[extension]->hostname = const_cast<char*>(host); // TODO: is this thread safe?
    }

    return SECSuccess;
}

TlsExtensionService::TlsExtensionService() {
    observersLock = PR_NewLock();
}

TlsExtensionService::~TlsExtensionService() {
    PR_DestroyLock(observersLock);
    // TODO free all Observers, patterns etc
}

std::map<PRUint16, TlsExtensionService::TlsExtObserverInfo*>
TlsExtensionService::GetObservers() { return observers; }

NS_IMETHODIMP
TlsExtensionService::GetExtensionSupport(uint16_t extension, SSLExtensionSupport *_retval) {
    SSL_GetExtensionSupport(extension, _retval);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::AddObserver(const char * urlPattern, PRUint16 extension, nsITlsExtensionObserver *observer) {
    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Observer was added to C++"));

    char* test;
    observer->OnWriteTlsExtension("test", "test", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &test);

    MOZ_LOG(gTLSEXTLog, LogLevel::Debug,
            ("Observer callback went through")); // if this does not work, its still either the object has to be stored or call from socket to main thread is bad. // works

    NS_ADDREF(observer); // this might not be required
    // observer->AddRef(); // is this required?
    auto *obsInfo = new TlsExtObserverInfo {
        .urlPattern = new std::regex(urlPattern),
        .extension = extension,
        .observer = observer,
    };
    // obsInfo->observer->AddRef();
    NS_ADDREF(obsInfo->observer);
    PR_Lock(observersLock);
    observers.insert({extension, obsInfo});
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::RemoveObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    observers.erase(extension);
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::HasObserver(PRUint16 extension, bool *_retval) {
    PR_Lock(observersLock);
    std::map<PRUint16, TlsExtObserverInfo*>::iterator it = observers.find(extension);
    *_retval = it != observers.end();
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMETHODIMP
TlsExtensionService::CallObserver(PRUint16 extension) {
    PR_Lock(observersLock);
    char* test;
    observers[extension]->observer->OnWriteTlsExtension("test", "test", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &test);
    PR_Unlock(observersLock);
    return NS_OK;
}

NS_IMPL_ISUPPORTS(TlsExtensionService::ObserverRunnable, nsIRunnable)

TlsExtensionService::ObserverRunnable::ObserverRunnable(TlsExtObserverInfo* obsInfo, mozilla::Monitor& monitor, char*& result):
    mozilla::Runnable("RunObserver"),
    obsInfo(obsInfo),
    monitor(monitor),
    result(result) {}

NS_IMETHODIMP
TlsExtensionService::ObserverRunnable::Run() {
    mozilla::MonitorAutoLock lock(monitor); // TODO is this required?
    obsInfo->observer->OnWriteTlsExtension("test", "ObserverTest", nsITlsExtensionObserver::SSLHandshakeType::ssl_hs_client_hello, 1000, &result);
    monitor.Notify();
    return NS_OK;
}
}