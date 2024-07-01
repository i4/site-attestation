#!/bin/bash

set -eu

if [ ! -f pub.key ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > pub.key
fi

echo NONCE: "${NONCE}"
echo HASHFILE: "/usr/local/nginx/${HASHFILE}"
echo OUTFILE: "/usr/local/nginx/${OUTFILE}"

touch "/usr/local/nginx/${OUTFILE}"

echo PWD: "$(pwd)"

printf "%s\n%s" "${NONCE}" "$(cat pub.key)"
printf "%s\n%s" "${NONCE}" "$(cat pub.key)" | sha512sum | awk '{print $1}' | xxd -r -p | tee "/usr/local/nginx/${HASHFILE}"


/home/ubuntu/snpguest/target/debug/snpguest report "/usr/local/nginx/${OUTFILE}" "/usr/local/nginx/${HASHFILE}"
