#!/usr/bin/env bash


CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
COMPOSE_FILE="$CURRENT/docker-compose.yaml"
docker-compose -f $COMPOSE_FILE down
docker container prune --force
ledgersData_root="$(dirname $CURRENT)/ledgersData"

sudo rm -rf $ledgersData_root # TODO for reset chaincode


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
docker-compose -f $COMPOSE_FILE up
