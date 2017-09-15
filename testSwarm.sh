#!/usr/bin/env bash
# TODO not ready

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

config_dir="$CURRENT/config"
CONFIG_JSON="$config_dir/orgs.json"
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"
COMPANY='delphi' # must match to config_json
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
VERSION=$(jq -r ".${COMPANY}.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"

TLS_ENABLED=true
COMPOSE_FILE="$config_dir/docker-swarm.yaml"


function viewService(){
    docker node ps "$1" # default to view current node
}
function viewInfo(){
    if [ -z "$1" ]; then
    docker node inspect self --pretty
    else
    docker node inspect "$1" --pretty
    fi
}
function getNodeID(){
    local hostName="$1"
    viewInfo "$hostName" | grep "ID"| awk '{print $2}'

}
function _changeHostName(){
    sudo gedit /etc/hostname /etc/hosts
}
function viewSwarm(){
    docker node ls
}

node_self=$(getNodeID "ubuntu")
node_fabricManager=$(getNodeID "fabric-swarm-manager")


./config/swarm-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -s $TLS_ENABLED -v $IMAGE_TAG
