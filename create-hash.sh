#!/bin/sh

if [ ! -f pub.key ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > pub.key
fi

echo "$NONCE\n$(cat pub.key)" | sha512sum | awk '{print $1}' | xxd -r -p > $HASHFILE
touch $OUTFILE

/home/ubuntu/snpguest/target/debug/snpguest report $OUTFILE $HASHFILE
