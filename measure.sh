#!/bin/sh

echo RATLS, no freshness
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --use-ratls

echo RATLS, FRESHNESS
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100 --use-ratls --request-freshness

echo NO RATLS
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=100
