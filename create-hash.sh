#!/bin/sh

if [ -f pub.key ]; then
  PUBKEY=$(cat pub.key)
else
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > pub.key
  PUBKEY=$(cat pub.key)
fi

echo OUTFILE: $OUTFILE
echo HASHFILE: $HASHFILE
echo PUBKEY: $PUBKEY

echo "$NONCE\n$PUBKEY"
echo "$NONCE\n$PUBKEY" | sha512sum
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}'
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p > $HASHFILE

/home/ubuntu/snpguest/target/debug/snpguest report $OUTFILE $HASHFILE
