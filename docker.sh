#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
COMPANY='delphi' # must match to config_json
COMPOSE_FILE="$config_dir/docker-compose.yaml"
CONFIG_JSON="$config_dir/orgs.json"

dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)


function down() {
    # NOTE deprecated: docker-compose -f $COMPOSE_FILE --project-name $projectName [action] :projectName is useless when setting network
	docker-compose -f $COMPOSE_FILE down
	docker container prune --force
	docker network prune --force
	docker image prune --force # NOTE	docker image prune --force : cannot remove chaincode image dev-peer0.bu.delphi.com-delphichaincode-v0-...

	FILTER="dev"

# TODO container prune might be necessary?
#	echo "=====containers to delete:"
#	docker ps -a | grep "$FILTER"
#	CONTAINER_IDS=$(docker ps -a | grep "$FILTER" | awk '{ print $1 }')
#	if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
#		echo "========== No containers available for deletion =========="
#	else
#		docker rm -f $CONTAINER_IDS
#	fi
	echo "=====images to delete:"
	DOCKER_IMAGE_IDS=$(docker images | grep "$FILTER" | awk '{print $3}')
	if [ -z "$DOCKER_IMAGE_IDS" -o "$DOCKER_IMAGE_IDS" = " " ]; then
		echo "========== No images available for deletion ==========="
	else
		docker rmi -f $DOCKER_IMAGE_IDS
	fi
	echo

}
function up() {
    docker network create delphiNetwork
	docker-compose -f $COMPOSE_FILE up
}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
