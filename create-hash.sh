#!/bin/bash

set -eu

PUBKEY_PATH=/usr/local/nginx/pubkey.pem

if [ ! -f "${PUBKEY_PATH}" ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > "${PUBKEY_PATH}"
fi

touch "${OUTFILE}.bin"

sha512sum "${CHALLENGE_PATH}" | xxd -r -p > "${HASHFILE}"

/home/ubuntu/snpguest/target/debug/snpguest report "${OUTFILE}.bin" "${HASHFILE}"
base64 "${OUTFILE}.bin" > "${OUTFILE}"
