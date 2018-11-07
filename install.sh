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
	local fabricTag=1.3.0
	local IMAGE_TAG="$fabricTag"
	docker pull hyperledger/fabric-ccenv:$IMAGE_TAG
	docker pull hyperledger/fabric-orderer:$IMAGE_TAG
	docker pull hyperledger/fabric-peer:$IMAGE_TAG
	docker pull hyperledger/fabric-ca:$IMAGE_TAG
}
function pullKafka() {
	local thirdPartyTag=0.4.13
	local IMAGE_TAG="$thirdPartyTag"
	docker pull hyperledger/fabric-kafka:$IMAGE_TAG
	docker pull hyperledger/fabric-zookeeper:$IMAGE_TAG
}
function updateChaincode() {
    export GOPATH=$(go env GOPATH)
    set +e
	go get -u -v "github.com/davidkhala/chaincode" # FIXME: please use your own chaincode as in config/chaincode.json
	set -e
	if ! dep version; then
		$CURRENT/common/install.sh golang_dep
		GOBIN=$GOPATH/bin/
		export PATH=$PATH:$GOBIN # ephemeral
	fi
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/admin
	dep ensure -update -v
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/master
	dep ensure -update -v
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/mainChain
	dep ensure -update -v
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/sideChain2
	dep ensure -update -v
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/sideChain
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
