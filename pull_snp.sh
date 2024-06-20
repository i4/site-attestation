#!/bin/sh

git pull origin filein-fileout
git checkout origin/filein-fileout
make
sudo objs/nginx
