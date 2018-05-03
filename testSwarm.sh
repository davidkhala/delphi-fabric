#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

CONFIG_DIR="$CURRENT/config"
SWARM_CONFIG="$CURRENT/swarm/swarm.json"

swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmServerIP=$(jq -r ".swarmServer.url" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}
if ! curl -s $swarmBaseUrl/; then
	echo no response from swarmServer $swarmBaseUrl
	exit 1
else echo
fi
CONFIG_JSON=$(curl -s ${swarmBaseUrl}/config/orgs)

./testBin.sh
MSPROOT_DIR=$(echo $CONFIG_JSON | jq -r ".docker.volumes.MSPROOT.dir")
CONFIGTX_DIR=$(echo $CONFIG_JSON | jq -r ".docker.volumes.CONFIGTX.dir")
MSPROOTVolume="MSPROOT_swarm"
CONFIGTXVolume="CONFIGTX_swarm"
./common/docker/utils/volume.sh createLocal $MSPROOTVolume $MSPROOT_DIR
./common/docker/utils/volume.sh createLocal $CONFIGTXVolume $CONFIGTX_DIR

COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
if [ -f "$COMPOSE_FILE" ]; then
	./docker-swarm.sh down
fi
node -e "require('./config/docker-compose').gen({MSPROOT:'$MSPROOT_DIR',COMPOSE_FILE:'$COMPOSE_FILE',type: 'swarm',volumeName:{CONFIGTX:'$CONFIGTXVolume',MSPROOT:'$MSPROOTVolume'}})"
