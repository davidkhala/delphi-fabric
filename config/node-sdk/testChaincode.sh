#!/usr/bin/env bash


CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"
PARENT=$(dirname $CURRENT)
CRYPTO_CONFIG_DIR="$PARENT/crypto-config"
network_config_json_output="test.json"

COMPANY='delphi'

sudo chmod -R 777 $CRYPTO_CONFIG_DIR
node network-config-gen.js $COMPANY -c $CRYPTO_CONFIG_DIR -o $network_config_json_output

cd ../../app
node test.js