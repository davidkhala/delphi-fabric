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
    set +e
	go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
	set -e
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

	./common/bin-manage/pull1_2.sh
	npm install
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
	updateChaincode
	# finally
	if [ $(uname)=="Darwin" ] ;then
        :
	else
	    sudo apt autoremove -y
	fi


fi
