#!/bin/sh

NONCE=$1
PUBKEY=$(openssl x509 -pubkey -in /usr/local/nginx/cert.pem | rg --multiline '\-\-\-\-\-BEGIN PUBLIC KEY\-\-\-\-\-[\d\D]*\-\-\-\-\-END PUBLIC KEY\-\-\-\-\-')

echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}'

# sha512sum 
