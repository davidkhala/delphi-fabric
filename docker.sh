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
	sleep 3 # TODO
	channelName=allchannel mocha channelSetup.js
}

prepareNetwork() {
	action=up node ./bootstrap.js
}
restart() {
	down
	up
}
if [[ -z "$1" ]]; then
	restart
else
	$1
fi
