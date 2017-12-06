#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
COMPANY='delphi' # must match to config_json
companyConfig=$(jq ".$COMPANY" $CONFIG_JSON)
volumesConfig=$(echo $companyConfig| jq -r ".docker.volumes")

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

./testBin.sh
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTX_DIR=$(echo $volumesConfig | jq -r ".CONFIGTX.dir")
MSPROOT_DIR=$(echo $volumesConfig| jq -r ".MSPROOT.dir") # update in testBin.sh



### setup nfs-server in host
./common/ubuntu/nfs.sh exposeHost "$CONFIGTX_DIR"
./common/ubuntu/nfs.sh exposeHost "$MSPROOT_DIR"

./common/ubuntu/nfs.sh startHost

thisHostName=$($CURRENT/common/ubuntu/hostname.sh get)
./common/docker/utils/swarm.sh addNodeLabels $thisHostName CONFIGTX=$CONFIGTX_DIR
./common/docker/utils/swarm.sh addNodeLabels $thisHostName MSPROOT=$MSPROOT_DIR
./common/docker/utils/swarm.sh getNodeLabels
./common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG # FIXME: rethink when to pull cc-env


COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
if [ -f "$COMPOSE_FILE" ]; then
	./docker-swarm.sh down
fi
node -e "require('./config/docker-compose').gen({'COMPANY':'$COMPANY','MSPROOT':'$MSPROOT_DIR','COMPOSE_FILE':'$COMPOSE_FILE','type': 'swarm'})"
