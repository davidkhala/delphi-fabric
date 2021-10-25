#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/
export finalityRequired=true
down() {

	mocha dockerode-bootstrap.js --grep "^down "
	sudo rm -rf $CURRENT/stateVolumes/*
}
up() {
	prepareNetwork
	export channelName=allchannel
	npm run channelSetup
}
mirror() {
	# TODO
	export channelName=mirror
	npm run channelSetup
}

prepareNetwork() {
	mocha dockerode-bootstrap.js --grep "^up " --bail
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
	cc
else
	"$@"
fi
