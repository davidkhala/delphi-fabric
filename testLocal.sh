#!/usr/bin/env bash
set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

CONFIG_DIR="$CURRENT/config"
CONFIG_JSON=$CONFIG_DIR/orgs.json

VERSION=$(jq -r ".docker.fabricTag" $CONFIG_JSON)

./common/bin-manage/pullBIN.sh -v $VERSION
./cluster/prepare.sh updateNODESDK $VERSION

./cluster/prepare.sh updateChaincode
