#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
utilsDir="$(dirname $CURRENT)/common/docker/utils"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"
COMPANY="delphi"

function pullImages() {
	#   please tracing https://github.com/moby/moby/issues/30951
	VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
	IMAGE_TAG="x86_64-$VERSION"
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
}
pullImages

