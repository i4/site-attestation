#!/bin/sh

echo RATLS, no freshness
src/httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --ratls

echo RATLS, FRESHNESS
src/httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --ratls --request-freshness

echo NO RATLS
src/httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100
