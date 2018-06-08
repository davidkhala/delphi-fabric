#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1
remain_params=""
for ((i = 2; i <= ${#}; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done



utilsDir=$CURRENT/common/docker/utils/
function gitSync() {
	git pull
	git submodule update --init --recursive
}

function pull() {
	local fabricTag=$1
	local IMAGE_TAG="x86_64-$fabricTag"
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ccenv:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-orderer:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-peer:$IMAGE_TAG
	$utilsDir/docker.sh pullIfNotExist hyperledger/fabric-ca:$IMAGE_TAG
}
function pullKafka() {
	local thirdPartyTag=$1
	local IMAGE_TAG="x86_64-$thirdPartyTag"
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

if [ -n "$fcn" ]; then
	$fcn $remain_params
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh

    CONFIG_JSON=$CURRENT/config/orgs.json

    fabricTag=$(jq -r ".docker.fabricTag" $CONFIG_JSON)

    ./common/bin-manage/pullBIN.sh -v $fabricTag
    updateNODESDK $fabricTag
	npm install
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
	updateChaincode
	# finally
    sudo apt autoremove -y
fi
