#!/usr/bin/env bash
set -e -x
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1
remain_params=""
for ((i = 2; i <= ${#}; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done

utilsDir=$CURRENT/common/docker/utils/
gitSync() {
	git pull
	git submodule update --init --recursive
}

pull() {
	local fabricTag=1.4.4
	local IMAGE_TAG="$fabricTag"
	docker pull hyperledger/fabric-ccenv:$IMAGE_TAG
	docker pull hyperledger/fabric-orderer:$IMAGE_TAG
	docker pull hyperledger/fabric-peer:$IMAGE_TAG
	docker pull hyperledger/fabric-ca:$IMAGE_TAG
}
pullKafka() {
	local thirdPartyTag=0.4.18
	local IMAGE_TAG="$thirdPartyTag"
	docker pull hyperledger/fabric-kafka:$IMAGE_TAG
	docker pull hyperledger/fabric-zookeeper:$IMAGE_TAG
}
updateChaincode() {
	export GO111MODULE=on

	goCmd="curl --silent --show-error https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/goCmd.sh"
	$goCmd | bash -s get https://github.com/davidkhala/chaincode.git

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/master
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/mainChain
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/diagnose
	go mod vendor
	cd -

	$goCmd | bash -s get https://github.com/davidkhala/stupid.git

	cd $GOPATH/src/github.com/davidkhala/stupid
	go mod vendor
	cd -
}

PM2CLI() {
	sudo npm install pm2@latest -g
}
sync() {
	gitSync
	$CURRENT/common/install.sh sync
	npm install
	updateChaincode
}
if [[ -n "$fcn" ]]; then
	$fcn $remain_params
else
	echo [debug] Current = ${CURRENT}
	if [[ ! -f "$CURRENT/common/install.sh" ]]; then
		gitSync
	fi
	$CURRENT/common/install.sh golang12
	$CURRENT/common/install.sh

	./common/bash/pullBIN.sh
	npm install
	updateChaincode
	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/docker-manager/master/dockerSUDO.sh | bash
fi
