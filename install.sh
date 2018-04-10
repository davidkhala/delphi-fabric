#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1

function cn() {
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh cn
	sudo apt -qq install -y moreutils
	npm install
}
function gitSync() {
	git pull
	git submodule update --init --recursive
}
function couchdb() {
	if ! service couchdb status 1>/dev/null; then
		echo "deb https://apache.bintray.com/couchdb-deb xenial main" | sudo tee -a /etc/apt/sources.list
		curl -L https://couchdb.apache.org/repo/bintray-pubkey.asc | sudo apt-key add -
		sudo apt-get update
		sudo apt-get install couchdb -y
	fi
}
if [ -n "$fcn" ]; then
	$fcn
else
	if [ ! -f "$CURRENT/common/install.sh" ]; then
		gitSync
	fi
	$CURRENT/common/install.sh
	# write to config: jq do not support in-place editing, use moreutils:sponge
	sudo apt -qq install -y moreutils
	npm install
	if ! go version; then
		$CURRENT/common/install.sh golang
	fi
fi
