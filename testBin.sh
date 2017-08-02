#!/usr/bin/env bash

sudo apt -qq install -y moreutils
# run cryptogen
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
remain_params=""
for (( i = 1; i <= $#; i ++ )); do
    j=${!i}
    remain_params="$remain_params $j"
done

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
CRYPTO_CONFIG_FILE="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
CRYPTO_CONFIG_DIR="$config_dir/crypto-config/"

COMPANY='delphi' # must match to config_json
# write to config: jq do not support in-place editing, use moreutils:sponge
jq ".$COMPANY.CRYPTO_CONFIG_DIR=\"$CRYPTO_CONFIG_DIR\"" $CONFIG_JSON | sponge $CONFIG_JSON
CONFIGTX_OUTPUT_DIR="$config_dir/configtx"
mkdir -p $CONFIGTX_OUTPUT_DIR

BLOCK_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.block"
CHANNEL_FILE="$CONFIGTX_OUTPUT_DIR/$COMPANY.channel"

PROFILE_BLOCK=${COMPANY}Genesis
PROFILE_CHANNEL=${COMPANY}Channel
CHANNEL_ID="delphiChannel"
IMAGE_TAG="x86_64-1.0.0"
TLS_ENABLED=true


./config/crypto-config-gen-go.sh $COMPANY -i $CRYPTO_CONFIG_FILE
./common/bin-manage/cryptogen/runCryptogen.sh -i "$CRYPTO_CONFIG_FILE" -o "$CRYPTO_CONFIG_DIR"

./config/configtx-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR -i $configtx_file -b $PROFILE_BLOCK -c $PROFILE_CHANNEL


./common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -p $PROFILE_BLOCK -i $config_dir
./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE -v -p $PROFILE_BLOCK -i $config_dir

./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $CHANNEL_FILE -p $PROFILE_CHANNEL -i $config_dir -c ${CHANNEL_ID,,}
./common/bin-manage/configtxgen/runConfigtxgen.sh channel view $CHANNEL_FILE -v -p $PROFILE_CHANNEL -i $config_dir



COMPOSE_FILE="$config_dir/docker-compose.yaml"


if [ -f "$COMPOSE_FILE" ]; then
    docker-compose -f $COMPOSE_FILE down
fi
./config/compose-gen-go.sh $COMPANY $CRYPTO_CONFIG_DIR $BLOCK_FILE -f $COMPOSE_FILE -s $TLS_ENABLED

# docker-compose -f $COMPOSE_FILE up


# network-config.json gen










