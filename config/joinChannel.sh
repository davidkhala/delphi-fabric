#!/usr/bin/env bash

# double join: status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists)

sudo apt-get -qq install -y jq
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_JSON="$CURRENT/orgs.json"

CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"

COMPANY=$1

CHANNEL_NAME=$2

PEER_CONTAINER=$3 # BUContainerName.delphi.com
remain_params=""
for ((i = 4; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "j:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done

echo ====$PEER_CONTAINER join channel

# NOTE do not feed -b with block file created by configtxgen,
# instead, the new file is created after channel created with FIX filename pattern: ${CHANNEL_ID,,}.block
joinCMD="peer channel join -b ${CHANNEL_NAME,,}.block"
echo CMD $joinCMD
docker exec -it $PEER_CONTAINER sh -c "$joinCMD"

echo =====$PEER_CONTAINER list channel
listCMD="peer channel list"
echo CMD $listCMD
docker exec -ti $PEER_CONTAINER sh -c "$listCMD"
