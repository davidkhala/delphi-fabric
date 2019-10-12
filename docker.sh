#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
export binPath=$CURRENT/common/bin/
down() {
	node -e "require('./dockerode-bootstrap').down()"
	sudo rm -rf $CURRENT/stateVolumes/*
}
up() {
	prepareNetwork
	node app/testChannel
}

prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up()"
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
