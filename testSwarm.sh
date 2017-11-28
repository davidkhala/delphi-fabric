#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
CRYPTO_CONFIG_DIR="$CONFIG_DIR/crypto-config/"
COMPANY='delphi' # must match to config_json
CONFIGTX_OUTPUT_DIR="$CONFIG_DIR/configtx"
BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"

TLS_ENABLED=$(jq ".$COMPANY.TLS" $CONFIG_JSON)
function _gluster() {
	# TODO not ready
	manager0_glusterRoot="/home/david/Documents/gluster"
	gluster peer probe $this_ip
	gluster peer probe $manager0_ip
	gluster peer status
	echo

}
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTXDir=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOTDir=$(echo $volumesConfig | jq -r ".MSPROOT.dir")



thisHostName=$($CURRENT/common/ubuntu/hostname.sh get)
$CURRENT/common/docker/utils/swarm.sh addNodeLabels $thisHostName CONFIGTX=$CONFIGTXDir
$CURRENT/common/docker/utils/swarm.sh addNodeLabels $thisHostName MSPROOT=$MSPROOTDir
$CURRENT/common/docker/utils/swarm.sh getNodeLabels

$CURRENT/config/swarm-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -s $TLS_ENABLED -v $IMAGE_TAG
