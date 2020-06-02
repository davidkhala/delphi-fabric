#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1
remain_params=""
for ((i = 2; i <= ${#}; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done

gitSync() {
	git pull
	git submodule update --init --recursive
}
updateChaincode() {
	goCmd="curl --silent --show-error https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/goCmd.sh"
	export GO111MODULE=on
	$goCmd | bash -s get "github.com/davidkhala/chaincode"

	echo "==source download complete=="
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/master
	go mod vendor
	cd -
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/mainChain
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/diagnose
	go mod vendor
	cd -
}

if [[ -n "$fcn" ]]; then
	$fcn $remain_params
else
	if [[ ! -f "$CURRENT/common/install.sh" ]]; then
		gitSync
	fi
	$CURRENT/common/install.sh golang
	$CURRENT/common/install.sh

	cd common
	./install.sh fabricInstall
	cd -

	npm install
	updateChaincode
	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/docker-manager/master/dockerSUDO.sh | bash
fi
