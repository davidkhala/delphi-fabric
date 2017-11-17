#!/usr/bin/env bash
set -e
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"

COMPANY='delphi' # must match to config_json
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
mkdir -p $CONFIGTX_OUTPUT_DIR

BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
VERSION=$(jq -r ".$COMPANY.docker.fabricTag" $CONFIG_JSON)
IMAGE_TAG="x86_64-$VERSION"
TLS_ENABLED=$(jq ".$COMPANY.TLS" $CONFIG_JSON)

$CURRENT/testBin.sh
COMPOSE_FILE="$config_dir/docker-compose.yaml"

if [ -f "$COMPOSE_FILE" ]; then
	$CURRENT/docker.sh down
fi
$CURRENT/config/compose-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -f $COMPOSE_FILE -s $TLS_ENABLED -v $IMAGE_TAG