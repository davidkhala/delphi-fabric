#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"

root="$(dirname $(dirname $CURRENT))"
CONFIG_DIR="$root/config/"
COMPANY="delphi"
SWARM_CONFIG="$CONFIG_DIR/swarm.json"

selectedIP="192.168.0.167"
utilsDir=$root/common/docker/utils
$utilsDir/swarm.sh create $selectedIP
$utilsDir/swarm.sh view


thisHostName=$($root/common/ubuntu/hostname.sh get)

jq ".$COMPANY.leaderNode.hostname=\"${thisHostName}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG
joinToken=$($root/common/docker/utils/swarm.sh managerToken)
jq ".$COMPANY.leaderNode.managerToken=\"${joinToken}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG


$root/cluster/prepare.sh
$root/testBin.sh
$root/testSwarm.sh
