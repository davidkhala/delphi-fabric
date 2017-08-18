#!/usr/bin/env bash

# TODO: not complete yet

sudo apt-get -qq install -y jq
CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

CONFIG_JSON="$CURRENT/orgs.json"

CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"
TLS_ENABLED=true

COMPANY=$1 # delphi

CHANNEL_NAME=$2 # delphichannel

PEER_CONTAINER=$3 # BUContainerName.delphi.com

CONTAINER_updateFile=$4 # /etc/hyperledger/configtx/config_update_as_envelope.block
remain_params=""
for ((i = 5; i <= $#; i++)); do
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
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

orderer_container_name=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON)

orderer_hostName=${orderer_container_name,,}
orderer_hostName_full=$orderer_hostName.$COMPANY_DOMAIN
ORDERER_CONTAINER=$orderer_container_name.$COMPANY_DOMAIN
tls_opts="--tls --cafile $CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/orderers/$orderer_hostName_full/tls/ca.crt"

ORDERER_ENDPOINT="$ORDERER_CONTAINER:7050" # Must for channel create or Error: Ordering service endpoint  is not valid or missing
# orderer endpoint should use container port
orderer_opts="-o $ORDERER_ENDPOINT"

echo =====$PEER_CONTAINER update channel
updateCMD="peer channel update -f $CONTAINER_updateFile $tls_opts $orderer_opts -c ${CHANNEL_NAME,,}"
echo CMD: $updateCMD
docker exec -ti $PEER_CONTAINER sh -c "$updateCMD"


# TODO peer channel update -f config_update_as_envelope.pb -c testchainid -o 127.0.0.1:7050
