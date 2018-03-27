#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON=$CONFIG_DIR/orgs.json

volumesConfig=$(jq -r ".docker.volumes" $CONFIG_JSON)

CONFIGTXVolume=CONFIGTX_local
MSPROOTVolume=MSPROOT_local

VERSION=$(jq -r ".docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"
TLS_ENABLED=$(jq ".TLS" $CONFIG_JSON)

./testBin.sh
COMPOSE_FILE="$CONFIG_DIR/docker-compose.yaml"

if [ -f "$COMPOSE_FILE" ]; then
	./docker.sh down
fi

docker volume prune --force
MSPROOT_DIR=$(echo $volumesConfig| jq -r ".MSPROOT.dir") # update in testBin.sh
CONFIGTX_DIR=$(echo $volumesConfig|jq -r ".CONFIGTX.dir") # update in testBin.sh

./common/docker/utils/volume.sh createLocal $MSPROOTVolume $MSPROOT_DIR
./common/docker/utils/volume.sh createLocal $CONFIGTXVolume $CONFIGTX_DIR

./common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
node -e "require('./config/docker-compose').gen({MSPROOT:'$MSPROOT_DIR',COMPOSE_FILE:'$COMPOSE_FILE',type: 'local',volumeName:{CONFIGTX:'$CONFIGTXVolume',MSPROOT:'$MSPROOTVolume'}})"