# Nginx with RATLS

## Creation Attestation Report

refer to file `create-hash.sh`, variables need to be set e.g. via `putenv()`.

## TLS patch

all happens in file `src/event/ngx_event_openssl.c`.
Headings are tags that you can find in the source code.

### RATLS DEFINITIONS

This defines constans, a data structure and the handler functions up until `RATLS DEFINITIONS END`.

### RATLS INSTALL HANDLER

This tells OpenSSL to install the aforedefined handlers to the TLS handshake.
