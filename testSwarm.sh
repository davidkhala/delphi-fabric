#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

GOPATH_SYS="/home/david/go"
CONFIG_DIR="$CURRENT/config"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
SWARM_CONFIG="$CONFIG_DIR/swarm.json"
CRYPTO_CONFIG_FILE="$CONFIG_DIR/crypto-config.yaml"
configtx_file="$CONFIG_DIR/configtx.yaml"
CRYPTO_CONFIG_DIR="$CONFIG_DIR/crypto-config/"
COMPANY='delphi' # must match to config_json
CONFIGTX_OUTPUT_DIR="$CONFIG_DIR/configtx"
BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"

TLS_ENABLED=true
COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTXDir=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOTDir=$(echo $volumesConfig | jq -r ".MSPROOT.dir")

function createSwarm() {
	ip="$1"
	docker swarm init --advertise-addr=${ip}
}
function _gluster(){
# TODO not ready
manager0_glusterRoot="/home/david/Documents/gluster"
gluster peer probe $this_ip
gluster peer probe $manager0_ip
gluster peer status
echo

}

thisHost=$(jq ".$COMPANY.thisHost" $SWARM_CONFIG)
thisHostName=$(echo $thisHost | jq -r ".hostname" )
otherHostConfig=$(jq ".$COMPANY.otherHost" $SWARM_CONFIG)
manager0_hostname="fabric-swarm-manager" # NOTE assuming hostName is unique

this_ip=$(./common/docker/utils/swarm.sh getNodeIP)
manager0_ip=$(./common/docker/utils/swarm.sh getNodeIP $manager0_hostname)

CONFIGTXVolume=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOTVolume=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")

./common/docker/utils/swarm.sh addNodeLabels $thisHostName CONFIGTX=$CONFIGTXDir
./common/docker/utils/swarm.sh addNodeLabels $thisHostName MSPROOT=$MSPROOTDir
./common/docker/utils/swarm.sh getNodeLabels

./config/swarm-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -s $TLS_ENABLED -v $IMAGE_TAG
