#!/bin/sh

NONCE=cat $1
FNAME=$2

if [ -f pub.key ]; then
  PUBKEY=$(cat pub.key)
else
  PUBKEY=$(openssl x509 -pubkey -in /usr/local/nginx/cert.pem | rg --multiline '\-\-\-\-\-BEGIN PUBLIC KEY\-\-\-\-\-[\d\D]*\-\-\-\-\-END PUBLIC KEY\-\-\-\-\-')
  echo -n $PUBKEY > pub.key
fi

echo -n "$NONCE\n$PUBKEY"
echo -n "$NONCE\n$PUBKEY" | sha512sum
echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}'
echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p
echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p > $FNAME

