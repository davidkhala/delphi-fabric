#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
COMPANY="delphi"

function pullImages() {
	#   please tracing https://github.com/moby/moby/issues/30951
	VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
	IMAGE_TAG="x86_64-$VERSION"
	../common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
	../common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
	../common/docker/utils/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
}
pullImages

