#!/bin/sh

httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=1000 --num-calls=1 --use-ratls > ratls-no-fresh-1000-1
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=10 --num-calls=100 --use-ratls > ratls-no-fresh-10-100

httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=1000 --num-calls=1 --use-ratls --request-freshness > ratls-freshness-1000-1
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=10 --num-calls=100 --use-ratls --request-freshness > ratls-freshness-10-100

httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=1000 --num-calls=1 > no-ratls-1000-1
httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --num-conns=10 --num-calls=100 > no-ratls-10-100
