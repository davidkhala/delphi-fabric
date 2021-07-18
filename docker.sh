#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/
down() {
	action=down node ./bootstrap.js
	sudo rm -rf $CURRENT/stateVolumes/*
}
up() {
	prepareNetwork
	export channelName=allchannel
	npm run channelSetup
}
mirror() {
	export channelName=mirror
	npm run channelSetup
}

prepareNetwork() {
	action=up node ./bootstrap.js
}
restart() {
	down
	up
}
cc() {
	mocha ./cc/golang/diagnose/install.js
	mocha ./cc/golang/diagnose/invoke.js --grep "^chaincode Initialize init$"

}
nodejscc() {
	mocha ./cc/node/diagnose/install.js
	mocha ./cc/node/diagnose/invoke.js --grep "^chaincode Initialize init$"
}
if [[ -z "$1" ]]; then
	export anchor=true
	restart
	nodejscc
else
	"$@"
fi
