#!/bin/bash

set -eu

if [ ! -f pub.key ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > pub.key
fi

echo NONCE: "${NONCE}"
echo HASHFILE: "${HASHFILE}"
echo OUTFILE: "${OUTFILE}"

echo PWD: "$(pwd)"

printf "%s\n%s" "${NONCE}" "$(cat pub.key)"
printf "%s\n%s" "${NONCE}" "$(cat pub.key)" | sha512sum | awk '{print $1}' | xxd -r -p | tee "${HASHFILE}"

touch "${OUTFILE}"

/home/ubuntu/snpguest/target/debug/snpguest report "${OUTFILE}" "${HASHFILE}"
