#!/usr/bin/env bash
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

FILTER="dev"
commonDir="$(dirname $CURRENT)/common"
$commonDir/rmChaincodeContainer.sh container $FILTER
$commonDir/rmChaincodeContainer.sh image $FILTER
docker system prune --force
