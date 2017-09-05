#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
config_dir="$CURRENT/config"
COMPANY='delphi' # must match to config_json
COMPOSE_FILE="$config_dir/docker-compose.yaml"
CONFIG_JSON="$config_dir/orgs.json"

projectName=$(jq -r ".$COMPANY.docker.projectName" $CONFIG_JSON)

function down() {
	docker-compose -f $COMPOSE_FILE --project-name $projectName down
	docker container prune --force
	docker network prune --force

	FILTER="dev"
	echo "=====containers to delete:"
	docker ps -a | grep "$FILTER"
	CONTAINER_IDS=$(docker ps -a | grep "$FILTER" | awk '{ print $1 }')
	if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
		echo "========== No containers available for deletion =========="
	else
		docker rm -f $CONTAINER_IDS
	fi
	echo "=====images to delete:"
	docker images | grep "none\|$FILTER"
	DOCKER_IMAGE_IDS=$(docker images | grep "none\|$FILTER" | awk '{print $3}')
	# FIXME: hyperledger images cannot be removed here???
	echo
	if [ -z "$DOCKER_IMAGE_IDS" -o "$DOCKER_IMAGE_IDS" = " " ]; then
		echo "========== No images available for deletion ==========="
	else
		docker rmi -f $DOCKER_IMAGE_IDS
	fi
	echo

}
function up() {
	docker-compose -f $COMPOSE_FILE --project-name $projectName up
}

if [ "$1" == "up" ]; then
	up
elif [ "$1" == "down" ]; then
	down
else
	down
	up
fi
