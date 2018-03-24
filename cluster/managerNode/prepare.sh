#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)

root="$(dirname $(dirname $CURRENT))"
ubuntuDir="$root/common/ubuntu"
utilsDir="$root/common/docker/utils"
CONFIG_DIR="$root/config"

SWARM_CONFIG="$root/swarm/swarm.json"

swarmServerIP="$1"
nodeHostName=$2 # new hostname

if [ -z $swarmServerIP ];then
    echo empty swarmServerIP [1st parameter]
    exit 1
fi

swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}

if ! curl -s http://$swarmBaseUrl/ ;then
    echo no response from swarmServer $swarmBaseUrl
    exit 1
else echo
fi

if [ -n "$nodeHostName" ];then
    $ubuntuDir/hostname.sh change $nodeHostName
fi

CONFIG_JSON=$(curl -s http://$swarmBaseUrl/config/orgs)
fabricTag=$(echo $CONFIG_JSON| jq -r ".docker.fabricTag")
$root/cluster/prepare.sh pull $fabricTag


CONFIGTX_nfs="$HOME/Documents/nfs/CONFIGTX"
MSPROOT_nfs="$HOME/Documents/nfs/MSPROOT"
CONFIGTX_volumeName="CONFIGTX_swarm"
MSPROOT_volumeName="MSPROOT_swarm"

mkdir -p $CONFIGTX_nfs
mkdir -p $MSPROOT_nfs

leaderInfo=$(curl -s http://${swarmBaseUrl}/leader)

joinToken=$(echo $leaderInfo| jq -r ".managerToken")
$joinToken # try to join

CONFIGTX_DIR=$(curl -X POST http://${swarmBaseUrl}/volume/get -d '{"key":"CONFIGTX"}' -H "Content-Type: application/json")

MSPROOT_DIR=$(curl -X POST http://${swarmBaseUrl}/volume/get -d '{"key":"MSPROOT"}' -H "Content-Type: application/json")

mainNodeIP=$(echo $leaderInfo | jq -r ".ip")
echo mountClient[MSPROOT] $MSPROOT_nfs $mainNodeIP $MSPROOT_DIR
$ubuntuDir/nfs.sh mountClient $MSPROOT_nfs $mainNodeIP $MSPROOT_DIR
echo mountClient[CONFIGTX] $CONFIGTX_nfs $mainNodeIP $CONFIGTX_DIR
$ubuntuDir/nfs.sh mountClient $CONFIGTX_nfs $mainNodeIP $CONFIGTX_DIR

$root/cluster/clean.sh
docker volume prune --force
$utilsDir/volume.sh createLocal $CONFIGTX_volumeName $CONFIGTX_nfs
$utilsDir/volume.sh createLocal $MSPROOT_volumeName $MSPROOT_nfs




