#!/usr/bin/env bash

# double join: status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists)

sudo apt-get -qq install -y jq
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_JSON="$CURRENT/orgs.json"

CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"
TLS_ENABLED=true

COMPANY=$1

CHANNEL_ID=$2

PEER_CONTAINER=$3 # BUContainerName.delphi.com
remain_params=""
for ((i = 4; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "j:s:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
	s)
		echo "set TLS_ENABLED string true|false (default: $TLS_ENABLED) ==> $OPTARG"
		TLS_ENABLED=$OPTARG
		;;
	?) #当有不认识的选项的时候arg为?
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
ORDERER_CONTAINER=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON).$COMPANY_DOMAIN
tls_opts="--tls --cafile $CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/orderers/$ORDERER_CONTAINER/tls/ca.crt"

ORDERER_ENDPOINT="$ORDERER_CONTAINER:7050" # Must for channel create or Error: Ordering service endpoint  is not valid or missing
# orderer endpoint should use container port
orderer_opts="-o $ORDERER_ENDPOINT"

echo ====$PEER_CONTAINER join channel

# NOTE do not feed -b with block file created by configtxgen,
# instead, the new file is created after channel created with FIX filename pattern: ${CHANNEL_ID,,}.block
docker exec -it $PEER_CONTAINER sh -c "peer channel join -b ${CHANNEL_ID,,}.block"

echo =====$PEER_CONTAINER list channel
docker exec -ti $PEER_CONTAINER sh -c "peer channel list $tls_opts $orderer_opts"
