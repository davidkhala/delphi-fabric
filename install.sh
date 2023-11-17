#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

gitSync() {
	git pull
	git submodule update --init --recursive
	cd common
	git checkout master
	git pull
}
updateChaincode() {
	
	cd ~
	git clone https://github.com/davidkhala/chaincode.git
	echo "==source download complete=="

	cd $CURRENT
}

if [[ -n "$1" ]]; then
	"$@"
else
	if [[ -z "$CI" ]]; then  
		gitSync
	fi  

	curl --silent --show-error https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/install.sh | bash -s latest
	cd common
	
	./install.sh
	./install.sh fabricInstall
	cd -

	npm install
	updateChaincode
fi
