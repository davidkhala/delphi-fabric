#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"

root="$(dirname $(dirname $CURRENT))"
ubuntuDir="$root/common/ubuntu"
utilsDir="$root/common/docker/utils"
CONFIG_DIR="$root/config"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
SWARM_CONFIG="$CONFIG_DIR/swarm.json"
COMPANY="delphi"

# change hostName
nodeHostName=$1 # "fabric-swarm-manager"
if [ -n "$nodeHostName" ];then
    $ubuntuDir/hostname.sh change $nodeHostName
fi


$root/cluster/prepare.sh


CONFIGTX_nfs="/home/david/Documents/nfs/CONFIGTX"
MSPROOT_nfs="/home/david/Documents/nfs/MSPROOT"


mainNodeID=$(jq -r ".$COMPANY.leaderNode.hostname" $SWARM_CONFIG) # TODO to query network map server

# NOTE using node labels to fetch directory information
CONFIGTX_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".CONFIGTX")

MSPROOT_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".MSPROOT")
thisIP=$($utilsDir/swarm.sh getNodeIP $mainNodeID)
if [ ! "$MSPROOT_DIR" == "null" ]; then
	$ubuntuDir/nfs.sh mount $MSPROOT_nfs $thisIP $MSPROOT_DIR
else
	echo label MSPROOT_DIR not exist in node $mainNodeID . exit
	exit 1
fi
if [ ! "$CONFIGTX_DIR" == "null" ]; then
	$ubuntuDir/nfs.sh mount $CONFIGTX_nfs $thisIP $CONFIGTX_DIR
else
	echo label CONFIGTX_DIR not exist in node $mainNodeID . exit
	exit 1
fi

volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTX_swarm=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOT_swarm=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")
$root/cluster/clean.sh
docker volume prune --force
$utilsDir/volume.sh createLocal $CONFIGTX_swarm $CONFIGTX_nfs
$utilsDir/volume.sh createLocal $MSPROOT_swarm $MSPROOT_nfs






