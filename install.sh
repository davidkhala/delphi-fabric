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
	mkdir -p $GOPATH/src/github.com/davidkhala/
	cd $GOPATH/src/github.com/davidkhala/
	set +e
	git clone "https://github.com/davidkhala/chaincode.git"
	set -e
	cd $GOPATH/src/github.com/davidkhala/chaincode
	git checkout release-1.4
	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/master
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/mainChain
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/chaincode/golang/diagnose
	go mod vendor
	cd -

	cd $GOPATH/src/github.com/davidkhala/
	set +e
	git clone https://github.com/davidkhala/stupid.git
	set -e
	cd $GOPATH/src/github.com/davidkhala/stupid
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
