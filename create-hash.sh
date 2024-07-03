#!/bin/bash

set -eu

PUBKEY_PATH=/usr/local/nginx/pubkey.pem
CHALLENGE_PATH="/usr/local/nginx/challenges/$(basename ${HASHFILE})"

if [ ! -f pub.key ]; then
  openssl x509 -noout -pubkey -in /usr/local/nginx/cert.pem > "${PUBKEY_PATH}"
fi

touch "${OUTFILE}"

printf "%s\n%s" "${NONCE}" "$(cat ${PUBKEY_PATH})" > "${CHALLENGE_PATH}"
sha512sum "${CHALLENGE_PATH}" | awk '{print $1}' | xxd -r -p > "${HASHFILE}"

/home/ubuntu/snpguest/target/debug/snpguest report "${OUTFILE}" "${HASHFILE}"
