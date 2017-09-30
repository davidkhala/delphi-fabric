#!/usr/bin/env bash
nodeID="fabric-swarm-manager"

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
utilsDir="$(dirname $CURRENT)/common/docker/utils"
ubuntuDir="$(dirname $CURRENT)/common/ubuntu"
mainNodeID="ubuntu"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
SWARM_CONFIG="$CONFIG_DIR/swarm.json"
COMPANY="delphi"
otherHostConfig=$(jq ".$COMPANY.otherHost" $SWARM_CONFIG)
hostConfig=$(echo $otherHostConfig| jq ".$nodeID")

volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)

thisIP=$($utilsDir/swarm.sh getNodeIP $mainNodeID)

CONFIGTX_nfs=$(echo $hostConfig|jq -r ".nfs.CONFIGTX")
MSPROOT_nfs=$(echo $hostConfig|jq -r ".nfs.MSPROOT")
# NOTE using node labels to fetch directory information
CONFIGTX_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".CONFIGTX")

MSPROOT_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".MSPROOT")
$ubuntuDir/hostname.sh change
if [ ! "$MSPROOT_DIR" == "null" ]; then
	$ubuntuDir/nfs.sh mount $MSPROOT_nfs $thisIP $MSPROOT_DIR
else
    echo label MSPROOT_DIR not exist in node $mainNodeID . exit
	exit 1
fi
if [ ! "$CONFIGTX_DIR" == "null" ]; then
	$ubuntuDir/nfs.sh mount $CONFIGTX_nfs $thisIP $CONFIGTX_DIR
else
    echo label  CONFIGTX_DIR not exist in node $mainNodeID . exit
	exit 1
fi
function pullImages(){
#   please tracing https://github.com/moby/moby/issues/30951
    VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
    IMAGE_TAG="x86_64-$VERSION"
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
}
pullImages
CONFIGTX_swarm=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOT_swarm=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")
docker container prune --force
docker volume prune --force # TODO
$utilsDir/volume.sh createLocal $CONFIGTX_swarm $CONFIGTX_nfs
$utilsDir/volume.sh createLocal $MSPROOT_swarm $MSPROOT_nfs
