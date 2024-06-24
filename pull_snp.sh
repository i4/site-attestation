#!/bin/sh

git pull origin filein-fileout
git checkout origin/filein-fileout
make
sudo rm /tmp/in-* /tmp/out-*
sudo objs/nginx
