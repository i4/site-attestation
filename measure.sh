#!/bin/sh

echo NO RATLS
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100

echo RATLS, no freshness
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --ratls

echo RATLS, FRESHNESS
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --ratls --request-freshness
