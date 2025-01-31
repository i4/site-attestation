#!/bin/sh

let num_conns = 1
let num_calls = [1 2 3]

let shared_args = $"--server=i4epyc1.cs.fau.de --port=443 --ssl --ssl-protocol=TLSv1_3 --timeout=10 --num-conns=($num_conns)"

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
            docker run httperf httperf ..$shared_args --num-calls=$"($c.num_calls)" ..$c.args |
            grep "Request rate:" |
            str substring 14..-1
        )
    } |
    to csv
