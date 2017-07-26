#!/usr/bin/env bash

# run cryptogen
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
remain_params=""
for (( i = 1; i <= $#; i ++ )); do
    j=${!i}
    remain_params="$remain_params $j"
done

config_dir="$CURRENT/config"
crypto_config_file="$config_dir/crypto-config.yaml"
configtx_file="$config_dir/configtx.yaml"
crypto_output_dir="$config_dir/crypto-config/"

company='delphi'
orgs_json='["BU","ENG","PM"]'
BLOCK_FILE="$config_dir/$company.block"
CHANNEL_FILE="$config_dir/$company.channel"


PROFILE_BLOCK=${company}Genesis
PROFILE_CHANNEL=${company}Channel
ORDERER_PORT=7050
ANCHOR_PEER_PORT=7051
CHANNEL_ID="testchainid"
IMAGE_TAG="x86_64-1.0.0"

$config_dir/crypto-config-gen-go.sh $company $orgs_json -i $crypto_config_file
./common/bin-manage/cryptogen/runCryptogen.sh -i "$crypto_config_file" -o "$crypto_output_dir"

$config_dir/configtx-gen-go.sh $company $orgs_json $crypto_output_dir -i $configtx_file -b $PROFILE_BLOCK -c $PROFILE_CHANNEL -o $ORDERER_PORT -a $ANCHOR_PEER_PORT


./common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -p $PROFILE_BLOCK -i $config_dir -c $CHANNEL_ID
./common/bin-manage/configtxgen/runConfigtxgen.sh block view $BLOCK_FILE -v -p $PROFILE_BLOCK -i $config_dir

./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $CHANNEL_FILE -p $PROFILE_CHANNEL -i $config_dir -c $CHANNEL_ID
./common/bin-manage/configtxgen/runConfigtxgen.sh channel view $CHANNEL_FILE -v -p $PROFILE_CHANNEL -i $config_dir


COMPOSE_FILE="$CURRENT/docker-compose-sample.yaml"

# TODO compose file





