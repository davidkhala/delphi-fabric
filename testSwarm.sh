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

VERSION=$(jq -r ".docker.fabricTag" $CONFIG_JSON)
./common/bin-manage/pullBIN.sh -v $VERSION
./cluster/prepare.sh updateNODESDK $VERSION

./cluster/prepare.sh updateChaincode
