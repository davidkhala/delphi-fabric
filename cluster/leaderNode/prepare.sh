#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
root="$(dirname $(dirname $CURRENT))"
CONFIG_DIR="$root/config/"
COMPANY="delphi"
SWARM_CONFIG="$CONFIG_DIR/swarm.json"

advertiseAddr="192.168.0.121"
if ! ip addr show | grep "inet ${advertiseAddr}";then
    echo advertiseAddr:$advertiseAddr is not one of IPs assinged to this machine
    ip addr show | grep "inet "
    exit 1
fi
### setup swarm
utilsDir=$root/common/docker/utils
$utilsDir/swarm.sh create $advertiseAddr
$utilsDir/swarm.sh view


thisHostName=$($root/common/ubuntu/hostname.sh get)

jq ".$COMPANY.leaderNode.hostname=\"${thisHostName}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG
joinToken=$($root/common/docker/utils/swarm.sh managerToken)
jq ".$COMPANY.leaderNode.managerToken=\"${joinToken}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG
jq ".$COMPANY.leaderNode.ip=\"${advertiseAddr}\"" $SWARM_CONFIG | sponge $SWARM_CONFIG


$root/cluster/prepare.sh

