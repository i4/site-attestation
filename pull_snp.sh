#!/bin/bash

set -eu

git pull origin filein-fileout
git checkout origin/filein-fileout

pushd /usr/local/nginx
mkdir requests reports hashes
popd

make
sudo objs/nginx
