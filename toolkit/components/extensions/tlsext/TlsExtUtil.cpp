#include "mozilla/extensions/TlsExtUtil.h"

namespace mozilla::extensions {
void*
TlsExtUtil::StrToPtr(const std::string& str) {
    void* ptr = nullptr;
    std::stringstream s(str);
    s >> ptr; // Extract the pointer from the string
    return ptr;
}

std::string
TlsExtUtil::PtrToStr(const void* ptr) {
    std::stringstream s;
    s << ptr;
    return s.str();
}
}
