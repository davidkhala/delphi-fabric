#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)
root="$(dirname $(dirname $CURRENT))"

SWARM_CONFIG="$root/swarm/swarm.json"

advertiseAddr="$1"
if [ -z $advertiseAddr ];then
    echo empty advertiseAddr [1st parameter]
    exit 1
fi

swarmServerIP="$2"

if [ -z $swarmServerIP ];then
    echo using advertiseAddr $advertiseAddr as swarmServerIP
    swarmServerIP=$advertiseAddr
fi

swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}
if ! curl -s http://$swarmBaseUrl/ ;then
    echo no response from swarmServer $swarmBaseUrl
    exit 1
else echo
fi

if ! ip addr show | grep "inet ${advertiseAddr}";then
    echo advertiseAddr:$advertiseAddr is not one of IPs assinged to this machine
    ip addr show | grep "inet "
    exit 1
fi
### setup swarm
utilsDir=$root/common/docker/utils

$utilsDir/swarm.sh createIfNotExist $advertiseAddr

thisHostName=$($root/common/ubuntu/hostname.sh get)

joinToken=$($root/common/docker/utils/swarm.sh managerToken)
node -e "require('$root/swarm/swarmServerClient').leader.update('http://$swarmBaseUrl', {ip:'$advertiseAddr', hostname:'$thisHostName', managerToken:'$joinToken'})"

$root/cluster/prepare.sh

