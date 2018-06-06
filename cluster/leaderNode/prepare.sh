#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root="$(dirname $(dirname $CURRENT))"

SWARM_CONFIG="$root/swarm/swarm.json"

advertiseAddr="$1"
if [ -z $advertiseAddr ]; then
	echo empty advertiseAddr [1st parameter]
	exit 1
fi

swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmServerIP=$(jq -r ".swarmServer.url" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}

pingResp=$(curl -sS $swarmBaseUrl/)
pingErrcode=$(echo $pingResp |jq -r ".errCode")
if [ $pingErrcode != "success" ]; then
	echo invalid response from swarmServer $swarmBaseUrl === $pingResp
	exit 1
else echo
fi

if ! ip addr show | grep "inet ${advertiseAddr}"; then
	echo advertiseAddr:$advertiseAddr is not one of IPs assinged to this machine
	ip addr show | grep "inet "
	exit 1
fi
CONFIG_JSON=$(curl -sS ${swarmBaseUrl}/config/orgs)
### setup swarm
utilsDir=$root/common/docker/utils

if ! $utilsDir/swarm.sh create $advertiseAddr; then
	echo ...perhaps swarm existing already of failure
	$utilsDir/swarm.sh view
fi

thisHostName=$($root/common/ubuntu/hostname.sh get)

joinToken=$($root/common/docker/utils/swarm.sh managerToken)
curl -sS -X POST ${swarmBaseUrl}/leader/update -d "{\"ip\":\"$advertiseAddr\",\"hostname\":\"$thisHostName\",\"managerToken\":\"$joinToken\"}" -H "Content-Type: application/json"

fabricTag=$(echo $CONFIG_JSON | jq -r ".docker.fabricTag")
thirdPartyTag=$(echo $CONFIG_JSON | jq -r ".docker.thirdPartyTag")
$root/cluster/prepare.sh pull $fabricTag
$root/cluster/prepare.sh pullKafka $thirdPartyTag

$root/common/bin-manage/pullBIN.sh -v $fabricTag

$root/cluster/prepare.sh updateNODESDK $fabricTag

$root/cluster/prepare.sh updateChaincode
