#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
utilsDir="$(dirname $CURRENT)/common/docker/utils"
mainNodeID="ubuntu"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
COMPANY="delphi"
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)


thisIP=$($utilsDir/swarm.sh getNodeIP $mainNodeID)

CONFIGTX_nfs="/home/david/Documents/nfs/CONFIGTX"
MSPROOT_nfs="/home/david/Documents/nfs/MSPROOT"
CONFIGTX_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".CONFIGTX")

MSPROOT_DIR=$($utilsDir/swarm.sh getNodeLabels $mainNodeID | jq -r ".MSPROOT")
if [ ! "$MSPROOT_DIR" == "null" ]; then
    $utilsDir/nfs.sh add $thisIP $MSPROOT_DIR $MSPROOT_nfs
else
    exit 1
fi
if [ ! "$CONFIGTX_DIR" == "null" ]; then
    $utilsDir/nfs.sh add $thisIP $CONFIGTX_DIR $CONFIGTX_nfs
else
    exit 1
fi
CONFIGTX_swarm=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOT_swarm=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")
$utilsDir/volume.sh createLocal $CONFIGTX_swarm $CONFIGTX_DIR
$utilsDir/volume.sh createLocal $MSPROOT_swarm $MSPROOT_DIR

