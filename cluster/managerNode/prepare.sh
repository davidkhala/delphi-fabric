#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

root="$(dirname $(dirname $CURRENT))"
ubuntuDir="$root/common/ubuntu"
utilsDir="$root/common/docker/utils"
CONFIG_DIR="$root/config"

SWARM_CONFIG="$root/swarm/swarm.json"

nodeHostName=$1 # new hostname

swarmServerIP=$(jq -r ".swarmServer.url" $SWARM_CONFIG)
swarmServerPort=$(jq ".swarmServer.port" $SWARM_CONFIG)
swarmBaseUrl=${swarmServerIP}:${swarmServerPort}

if ! curl -s $swarmBaseUrl/; then
	echo no response from swarmServer $swarmBaseUrl
	exit 1
else echo
fi

if [ -n "$nodeHostName" ]; then
	$ubuntuDir/hostname.sh change $nodeHostName
fi

CONFIG_JSON=$(curl -s $swarmBaseUrl/config/orgs)
fabricTag=$(echo $CONFIG_JSON | jq -r ".docker.fabricTag")
$root/cluster/prepare.sh pull $fabricTag
thirdPartyTag=$(echo $CONFIG_JSON | jq -r ".docker.thirdPartyTag")
$root/cluster/prepare.sh pullKafka $thirdPartyTag

CONFIGTX_nfs="$HOME/Documents/nfs/CONFIGTX/"
# MSPROOT_nfs="$HOME/Documents/nfs/MSPROOT/"
CONFIGTX_volumeName="CONFIGTX_swarm"
MSPROOT_volumeName="MSPROOT_swarm"

mkdir -p $CONFIGTX_nfs
# mkdir -p $MSPROOT_nfs

leaderInfo=$(curl -s ${swarmBaseUrl}/leader)

joinToken=$(echo $leaderInfo | jq -r ".managerToken")
echo joinToken | $joinToken |
	if ! $joinToken; then
		echo ... perhaps joined already.
		$utilsDir/swarm.sh view
	fi

thisHostName=$(hostname)
thisNodeIP=$($root/common/docker/utils/swarm.sh getNodeIP)
curl -s -X POST ${swarmBaseUrl}/manager/join -d "{\"ip\":\"${thisNodeIP}\",\"hostname\":\"${thisHostName}\"}" -H "Content-Type: application/json"

CONFIGTX_DIR=$(eval echo $(curl -s -X POST ${swarmBaseUrl}/volume/get -d '{"key":"CONFIGTX"}' -H "Content-Type: application/json"))

MSPROOT_DIR=$(eval echo $(curl -s -X POST ${swarmBaseUrl}/volume/get -d '{"key":"MSPROOT"}' -H "Content-Type: application/json"))

mainNodeIP=$(echo $leaderInfo | jq -r ".ip")
echo mountClient[CONFIGTX] $CONFIGTX_nfs $mainNodeIP $CONFIGTX_DIR
sudo $ubuntuDir/nfs.sh mountClient $CONFIGTX_nfs $mainNodeIP $CONFIGTX_DIR

$root/cluster/clean.sh
docker volume prune --force
$utilsDir/volume.sh createLocal $CONFIGTX_volumeName $CONFIGTX_nfs
