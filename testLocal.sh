#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON=$CONFIG_DIR/orgs.json

COMPANY='delphi' # must match to config_json
companyConfig=$(jq ".$COMPANY" $CONFIG_JSON)
volumesConfig=$(echo $companyConfig| jq -r ".docker.volumes")

CONFIGTXVolume=$(echo $volumesConfig | jq -r ".CONFIGTX.local")
MSPROOTVolume=$(echo $volumesConfig | jq -r ".MSPROOT.local")

VERSION=$(jq -r ".$COMPANY.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"
TLS_ENABLED=$(jq ".$COMPANY.TLS" $CONFIG_JSON)

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
node -e "require('./config/docker-compose').gen({'COMPANY':'$COMPANY','MSPROOT':'$MSPROOT_DIR','COMPOSE_FILE':'$COMPOSE_FILE','type': 'local'})"