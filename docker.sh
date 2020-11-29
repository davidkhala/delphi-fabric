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
	channelName=allchannel mocha app/channelSetup.js --grep "create$"
	channelName=allchannel mocha app/channelSetup.js --grep "join$"
	if [[ -n "$anchor" ]]; then
		channelName=allchannel mocha app/channelSetup.js --grep "setup anchor peer$"
	fi

	#	taskID=2 viaServer=true channelName=allchannel node app/channelSetup.js #
	#	channelName=extrachannel node app/channelSetup.js
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
	mocha ./cc/node/diagnose/install.js
	mocha ./cc/node/diagnose/invoke.js --grep "^chaincode Initialize init$"
}
if [[ -z "$1" ]]; then
	export anchor=true
	restart
	cc
else
	$1
fi
