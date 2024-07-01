#!/bin/sh

if [ ! -f pub.key ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem &2>1 > pub.key
fi
PUBKEY=$(cat pub.key)

echo OUTFILE: $OUTFILE
echo HASHFILE: $HASHFILE
echo PUBKEY: $PUBKEY

echo "$NONCE\n$(cat pub.key)"
echo '$NONCE\n$(cat pub.key)'
echo "$NONCE\n$PUBKEY" | sha512sum
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}'
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p
echo "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p > $HASHFILE

/home/ubuntu/snpguest/target/debug/snpguest report $OUTFILE $HASHFILE
