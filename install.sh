#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

gitSync() {
	git pull
	git submodule update --init --recursive
}

updateChaincode() {
	export GO111MODULE=on

	GOPATH=$(go env GOPATH)

	curl https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/goCmd.sh | bash -s get github.com/davidkhala/chaincode release-1.4

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/stress
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
	$CURRENT/common/install.sh golang13
	$CURRENT/common/install.sh

	cd common
	./install.sh fabricInstall
	cd -
	npm install
	updateChaincode
	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/docker-manager/master/dockerSUDO.sh | bash
fi
