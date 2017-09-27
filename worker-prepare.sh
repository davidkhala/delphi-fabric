#!/usr/bin/env bash
sudo apt-get -qq install -y jq
mainNodeID="ubuntu"

thisIP=$(./common/docker/utils/swarm.sh getNodeIP $mainNodeID)

CONFIGTX_nfs="/home/david/Documents/nfs/CONFIGTX"
MSPROOT_nfs="/home/david/Documents/nfs/MSPROOT"
CONFIGTX_DIR=$(./common/docker/utils/swarm.sh getNodeLabels $mainNodeID | jq -r ".CONFIGTX")

MSPROOT_DIR=$(./common/docker/utils/swarm.sh getNodeLabels $mainNodeID | jq -r ".MSPROOT")
if [ ! "$MSPROOT_DIR" == "null" ]; then
	./common/docker/utils/nfs.sh add $thisIP $MSPROOT_DIR $MSPROOT_nfs
fi
if [ ! "$CONFIGTX_DIR" == "null" ]; then
	./common/docker/utils/nfs.sh add $thisIP $CONFIGTX_DIR $CONFIGTX_nfs
fi
