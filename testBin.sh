#!/usr/bin/env bash

# run cryptogen
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
remain_params=""
for (( i = 1; i <= $#; i ++ )); do
    j=${!i}
    remain_params="$remain_params $j"
done

config_dir="$CURRENT/config"
CONFIG_JSON=$config_dir/orgs.json
crypto_config_file="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
crypto_output_dir="$config_dir/crypto-config/"

company='delphi' # must match to config_json
BLOCK_FILE="$config_dir/$company.block"
CHANNEL_FILE="$config_dir/$company.channel"


PROFILE_BLOCK=${company}Genesis
PROFILE_CHANNEL=${company}Channel
CHANNEL_ID="testchainid"
IMAGE_TAG="x86_64-1.0.0"



./config/crypto-config-gen-go.sh $company -i $crypto_config_file
./common/bin-manage/cryptogen/runCryptogen.sh -i "$crypto_config_file" -o "$crypto_output_dir"

./config/configtx-gen-go.sh $company $crypto_output_dir -i $configtx_file -b $PROFILE_BLOCK -c $PROFILE_CHANNEL


./common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -p $PROFILE_BLOCK -i $config_dir -c $CHANNEL_ID
./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE -v -p $PROFILE_BLOCK -i $config_dir

./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $CHANNEL_FILE -p $PROFILE_CHANNEL -i $config_dir -c $CHANNEL_ID
./common/bin-manage/configtxgen/runConfigtxgen.sh channel view $CHANNEL_FILE -v -p $PROFILE_CHANNEL -i $config_dir
#
#
COMPOSE_FILE="$config_dir/docker-compose.yaml"
./config/compose-gen-go.sh $company $crypto_output_dir $BLOCK_FILE

# TODO compose file





