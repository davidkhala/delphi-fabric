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
	local fabricTag=1.2.0
	local IMAGE_TAG="$fabricTag"
	docker pull hyperledger/fabric-ccenv:$IMAGE_TAG
	docker pull hyperledger/fabric-orderer:$IMAGE_TAG
	docker pull hyperledger/fabric-peer:$IMAGE_TAG
	docker pull hyperledger/fabric-ca:$IMAGE_TAG
}
function pullKafka() {
	local thirdPartyTag=0.4.10
	local IMAGE_TAG="$thirdPartyTag"
	docker pull hyperledger/fabric-kafka:$IMAGE_TAG
	docker pull hyperledger/fabric-zookeeper:$IMAGE_TAG
}
function updateChaincode() {
    set +e
	go get -u "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
	set -e
	GOPATH=$(go env GOPATH)
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/admin
	dep ensure -update -v
	cd -
}

function PM2CLI(){
    sudo npm install pm2@latest -g
}
if [ -n "$fcn" ]; then
	$fcn $remain_params
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh golang1_10
	$CURRENT/common/install.sh

	./common/bin-manage/pullBIN.sh
	npm install
	updateChaincode
	./common/docker/dockerSUDO.sh
fi
