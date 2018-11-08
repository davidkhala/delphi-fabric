#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function down() {
	node -e "require('./dockerode-bootstrap').down()"
    sudo rm -rf $HOME/Documents/backupVolumes/peer1.icdd.org/
    mkdir -p $HOME/Documents/backupVolumes/peer1.icdd.org/
}
function up() {
	prepareNetwork
	node app/testChannel
	node cc/masterInstall
	node cc/testMaster.js
}

function prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up()"
}

function restart() {
	down
	up
}

if [ -z "$1" ]; then
	restart
else
	$1
fi
