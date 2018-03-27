#!/usr/bin/env bash

CURRENT=$(cd $(dirname ${BASH_SOURCE}); pwd)
fcn=$1
remain_params=""
for ((i = 2; i <= ${#}; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
function pull(){
    local fabricTag=$1;
    local IMAGE_TAG="x86_64-$fabricTag"
    utilsDir=$(dirname $CURRENT)/common/docker/utils/
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ca:$IMAGE_TAG
}
function pullKafka(){
    local fabricTag=$1;
    local IMAGE_TAG="x86_64-$fabricTag"
    $utilsDir/docker.sh pullIfNotExist hyperledger/fabric-kafka:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-zookeeper:$IMAGE_TAG
}
$fcn $remain_params

