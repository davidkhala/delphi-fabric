#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
CONFIG_DIR="$(dirname $CURRENT)/config/"
CONFIG_JSON="$CONFIG_DIR/orgs.json"

#   please tracing https://github.com/moby/moby/issues/30951
VERSION=$(jq -r ".docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"
utilsDir=$(dirname $CURRENT)/common/docker/utils/
$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG

function pullKafka(){
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-kafka:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-zookeeper:$IMAGE_TAG
}
kafkaMode=$(jq -r ".orderer.type" $CONFIG_JSON)
if [ "$kafkaMode" == "kafka" ];then
    pullKafka
fi

