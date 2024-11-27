#ifndef mozilla_extensions_TlsExtUtil_h__
#define mozilla_extensions_TlsExtUtil_h__

#include <string>
#include <sstream>

namespace mozilla::extensions {
class TlsExtUtil {
    public:
    static std::string PtrToStr(const void* ptr);
    static void* StrToPtr(const std::string& str);
};
}

#endif
