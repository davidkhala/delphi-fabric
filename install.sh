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
gitSync() {
	git pull
	git submodule update --init --recursive
}
pull() {
	local IMAGE_TAG=${1:-2.0.0-alpha}
	docker pull hyperledger/fabric-ccenv:$IMAGE_TAG
	docker pull hyperledger/fabric-orderer:$IMAGE_TAG
	docker pull hyperledger/fabric-peer:$IMAGE_TAG
	docker pull hyperledger/fabric-ca:$IMAGE_TAG
}
updateChaincode() {
	export GOPATH=$(go env GOPATH)
	set +e
	go get -u -v "github.com/davidkhala/chaincode"
	set -e
	if ! dep version; then
		$CURRENT/common/install.sh golang_dep
		GOBIN=$GOPATH/bin/
		export PATH=$PATH:$GOBIN # ephemeral
	fi
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/master
	dep ensure
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/mainChain
	dep ensure
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/diagnose
	dep ensure
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
	if [[ ! -f "$CURRENT/common/install.sh" ]]; then
		gitSync
	fi
	$CURRENT/common/install.sh golang
	$CURRENT/common/install.sh

	./common/bin-manage/pullBIN.sh
	npm install
	updateChaincode
	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/docker-manager/master/dockerSUDO.sh | bash
fi
