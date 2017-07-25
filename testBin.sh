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
crypto_output_dir="$config_dir/crypto-config/"

./common/bin-manage/cryptogen/runCryptogen.sh -i "$crypto_config_file" -o "$crypto_output_dir"

#BLOCK_FILE="$config_dir/delphi.block"
#CHANNEL_FILE="$config_dir/delphi.channel"
#PROFILE_BLOCK="DelphiGenesis"
#PROFILE_CHANNEL="DelphiChannel"
#CHANNEL_ID="testchainid"
#./common/bin-manage/configtxgen/runConfigtxgen.sh block create $BLOCK_FILE -a -p $PROFILE_BLOCK
#
#./common/bin-manage/configtxgen/runConfigtxgen.sh channel create $CHANNEL_FILE -a -p $PROFILE_CHANNEL -c $CHANNEL_ID


