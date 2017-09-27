#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_DIR="$CURRENT/config"
COMPOSE_FILE="$CONFIG_DIR/docker-swarm.yaml"
COMPANY="delphi"
CONFIG_JSON="$CONFIG_DIR/orgs.json"

swarmNetwork=$(jq -r ".$COMPANY.docker.network" ${CONFIG_JSON})

function down() {
    docker stack rm $swarmNetwork
	docker network prune --force
}
function up() {

	# NOTE Manager not online: The swarm does not have a leader. It's possible that too few managers are online. Make sure more than half of the managers are online.
	docker network create --driver overlay $swarmNetwork # then the scope is swarm, indicates that only hosts participating in the swarm can access this network

	# TODO when exist: network "delphiNetwork" is declared as external, but it is not in the right scope: "local" instead of "swarm"
	# TODO when not exist: network "delphiNetwork" is declared as external, but could not be found. You need to create a swarm-scoped network before the stack is deployed
	docker stack up --compose-file=$COMPOSE_FILE $swarmNetwork

}
if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
