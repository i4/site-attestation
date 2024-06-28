#!/bin/sh

git pull origin filein-fileout
git checkout origin/filein-fileout
mkdir requests reports hashes

make
sudo objs/nginx
