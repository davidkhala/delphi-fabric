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
	channelName=allchannel mocha channelSetup.js
	channelName=extrachannel mocha channelSetup.js
}

prepareNetwork() {
	action=up node ./bootstrap.js
}
restart() {
	down
	up
}
repeat() {
	local times=5
	for ((i = 1; i <= times; i++)); do
		./docker.sh
	done
}
if [[ -z "$1" ]]; then
	restart
else
	$1
fi
