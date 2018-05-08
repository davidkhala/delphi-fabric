#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
root=$(dirname $CURRENT)
fcn=$1
remain_params=""
for ((i = 2; i <= ${#}; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
function pull() {
	local fabricTag=$1
	local IMAGE_TAG="x86_64-$fabricTag"
	utilsDir=$root/common/docker/utils/
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ca:$IMAGE_TAG
}
function pullKafka() {
	local thirdPartyTag=$1
	local IMAGE_TAG="x86_64-$thirdPartyTag"
	utilsDir=$(dirname $CURRENT)/common/docker/utils/
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-kafka:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-zookeeper:$IMAGE_TAG
}
function updateChaincode() {
	go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
}
function updateNODESDK() {
	local VERSION=$1
	if npm list fabric-client@$VERSION --depth=0; then : # --depth=0 => list only top level modules
	else
		npm install fabric-client@$VERSION --save --save-exact
	fi
	if npm list fabric-ca-client@$VERSION --depth=0; then :
	else
		npm install fabric-ca-client@$VERSION --save --save-exact
	fi
}

$fcn $remain_params
