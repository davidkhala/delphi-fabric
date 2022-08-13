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

  mkdir -p ~/Documents
  cd ~/Documents
  git clone https://github.com/davidkhala/chaincode.git
	echo "==source download complete=="

	cd $CURRENT
}

if [[ -n "$1" ]]; then
	"$@"
else
	if [[ ! -f "$CURRENT/common/install.sh" ]]; then
		gitSync
	fi

	cd common
	./install.sh golang
	./install.sh
	./install.sh fabricInstall
	cd -

	npm install
	updateChaincode
fi
