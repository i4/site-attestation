#!/bin/bash

set -eu

PUBKEY_PATH=/usr/local/nginx/pubkey.pem

if [ ! -f "${PUBKEY_PATH}" ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > "${PUBKEY_PATH}"
fi

touch "${OUTFILE}"

sha512sum "${CHALLENGE_PATH}" | xxd -r -p > "${HASHFILE}"

/home/ubuntu/snpguest/target/debug/snpguest report "${OUTFILE}" "${HASHFILE}"
/home/ubuntu/snpguest/target/debug/snpguest fetch vcek pem genoa /usr/local/nginx/certs "${OUTFILE}"

