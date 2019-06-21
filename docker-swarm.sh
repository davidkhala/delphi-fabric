#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)
fcn=$1

down() {
	node -e "require('./dockerode-bootstrap').down(true)"
}
prepareNetwork() {
	node -e "require('./dockerode-bootstrap').up(true)"
}
up() {
	prepareNetwork
	node app/testChannel.js
}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
