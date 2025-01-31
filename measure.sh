#!/bin/sh

SHARED_ARGS="--server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3"

httperf ${SHARED_ARGS} --num-conns=500 --num-calls=1 --use-ratls > ratls-no-fresh-single
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=10 --use-ratls > ratls-no-fresh-10
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=100 --use-ratls > ratls-no-fresh-100

httperf ${SHARED_ARGS} --num-conns=500 --num-calls=1 --use-ratls --request-freshness > ratls-freshness-single
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=10 --use-ratls --request-freshness > ratls-freshness-10
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=100 --use-ratls --request-freshness > ratls-freshness-100

httperf ${SHARED_ARGS} --num-conns=500 --num-calls=1 > no-ratls-single
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=10 > no-ratls-10
httperf ${SHARED_ARGS} --num-conns=100 --num-calls=100 > no-ratls-100
