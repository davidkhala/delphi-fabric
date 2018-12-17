#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

function down() {
	node -e "require('./dockerode-bootstrap').down()"
}
function up() {
	prepareNetwork
	node app/testChannel
	node cc/diagnose
}

function prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up()"
}
function peerRecoverTest(){
    down
    sudo rm -rf $HOME/Documents/backupVolumes/
    mkdir -p $HOME/Documents/backupVolumes/peer1.icdd.org/
    up
    node app/testPeerBackup
}
function ordererRecoverTest(){
    down
    sudo rm -rf $HOME/Documents/backupVolumes/
    mkdir -p $HOME/Documents/backupVolumes/orderer2/
    up
    node app/testOrdererBackup
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
