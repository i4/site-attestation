#!/bin/sh

let num_conns = 1000
let num_calls = [1 100 10000]

let configs = [
    {
        name: "no-ratls",
        args: "",
    }
    {
        name: "ratls-no-fresh",
        args: "--use-ratls",
    }
    {
        name: "ratls-freshness",
        args: "--use-ratls --request-freshness",
    }
]

$configs |
    each {|c|
        $num_calls |
        each {|n|
            $c |
            insert "num_calls" $n |
            update name $"($c.name)-($n)"
        }
    } |
    flatten |
    each {|c|
        $c | insert rate (
            docker run httperf httperf --server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --timeout=10000 --num-conns=$"($num_conns)" --num-calls=$"($c.num_calls)" ..$c.args |
            grep "Request rate:" |
            str substring 14..-1
        )
    } |
    select name rate |
    to csv
