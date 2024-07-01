#!/bin/sh

if [ -f pub.key ]; then
  PUBKEY=$(cat pub.key)
else
  PUBKEY=$(openssl x509 -pubkey -in /usr/local/nginx/cert.pem | rg --multiline '\-\-\-\-\-BEGIN PUBLIC KEY\-\-\-\-\-[\d\D]*\-\-\-\-\-END PUBLIC KEY\-\-\-\-\-')
  echo -n $PUBKEY > pub.key
fi

echo OUTFILE: $OUTFILE
echo HASHFILE: $HASHFILE
echo PUBKEY: $PUBKEY

# echo -n "$NONCE\n$PUBKEY"
# echo -n "$NONCE\n$PUBKEY" | sha512sum
# echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}'
# echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p
echo -n "$NONCE\n$PUBKEY" | sha512sum | awk '{print $1}' | xxd -r -p > $HASHFILE

/home/ubuntu/snpguest/target/debug/snpguest report $OUTFILE $HASHFILE
