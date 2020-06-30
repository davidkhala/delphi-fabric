#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

gitSync() {
	git pull
	git submodule update --init --recursive
}
updateChaincode() {
	goCmd="curl --silent --show-error https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/goCmd.sh"
	export GO111MODULE=on
	$goCmd | bash -s get "github.com/davidkhala/chaincode"

	echo "==source download complete=="

	if [[ -z "$GOPATH" ]]; then
		export GOPATH=$(go env GOPATH)
	fi
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

if [[ -n "$1" ]]; then
	"$@"
else
	if [[ ! -f "$CURRENT/common/install.sh" ]]; then
		gitSync
	fi
	$CURRENT/common/install.sh golang
	$CURRENT/common/install.sh

	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/docker-manager/master/dockerSUDO.sh | bash
	cd common
	./install.sh fabricInstall
	cd -

	npm install
	if [[ -z "$CI" ]]; then
		sudo npm install --global mocha
	fi
	updateChaincode
fi
