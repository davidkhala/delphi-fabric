#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

root="$(dirname $(dirname $CURRENT))"
ubuntuDir="$root/common/ubuntu"
utilsDir="$root/common/docker/utils"
CONFIG_DIR="$root/config"

SWARM_CONFIG="$root/swarm/swarm.json"

swarmServerIP=$(jq -r ".swarmServer.url" $SWARM_CONFIG)
swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}

if ! curl -sS $swarmBaseUrl/; then
	echo no response from swarmServer $swarmBaseUrl
	exit 1
fi

CONFIG_JSON=$(curl -sS $swarmBaseUrl/config/orgs)
fabricTag=$(echo $CONFIG_JSON | jq -r ".docker.fabricTag")
$root/cluster/prepare.sh pull $fabricTag
thirdPartyTag=$(echo $CONFIG_JSON | jq -r ".docker.thirdPartyTag")
$root/cluster/prepare.sh pullKafka $thirdPartyTag

leaderInfo=$(curl -sS ${swarmBaseUrl}/leader)
echo leaderInfo $leaderInfo
joinToken=$(echo $leaderInfo | jq -r ".managerToken")
if ! $joinToken; then
	echo ... perhaps joined already.
	$utilsDir/swarm.sh view
fi

thisHostName=$(hostname)
thisNodeIP=$($root/common/docker/utils/swarm.sh getNodeIP)
curl -sS -X POST ${swarmBaseUrl}/manager/join -d "{\"ip\":\"${thisNodeIP}\",\"hostname\":\"${thisHostName}\"}" -H "Content-Type: application/json"

$root/cluster/clean.sh
