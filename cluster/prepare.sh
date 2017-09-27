#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
mainNodeID="ubuntu"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
COMPANY="delphi"
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)


thisIP=$(../common/docker/utils/swarm.sh getNodeIP $mainNodeID)

CONFIGTX_nfs="/home/david/Documents/nfs/CONFIGTX"
MSPROOT_nfs="/home/david/Documents/nfs/MSPROOT"
CONFIGTX_DIR=$(../common/docker/utils/swarm.sh getNodeLabels $mainNodeID | jq -r ".CONFIGTX")

MSPROOT_DIR=$(../common/docker/utils/swarm.sh getNodeLabels $mainNodeID | jq -r ".MSPROOT")
if [ ! "$MSPROOT_DIR" == "null" ]; then
	../common/docker/utils/nfs.sh add $thisIP $MSPROOT_DIR $MSPROOT_nfs
else
 exit 1
fi
if [ ! "$CONFIGTX_DIR" == "null" ]; then
	../common/docker/utils/nfs.sh add $thisIP $CONFIGTX_DIR $CONFIGTX_nfs
	else exit 1
fi
CONFIGTX_swarm=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOT_swarm=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")
../common/docker/utils/volume.sh createLocal $CONFIGTX_swarm $MSPROOT_DIR
../common/docker/utils/volume.sh createLocal $MSPROOT_swarm $CONFIGTX_DIR

