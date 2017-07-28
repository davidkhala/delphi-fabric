#!/usr/bin/env bash


sudo apt-get -qq install -y jq
#NOTE when 'peer channel create' Caused by: x509: certificate is valid for peer0.pm.delphi.com, peer0, not PMContainerName.delphi.com,
#   Fixed by setting CORE_PEER_ID=peer0.pm.delphi.com

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
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)
container_name=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON)
hostName=${container_name,,} # SHOULD be the same with containerName, otherwize TLS problem
orderer_host=$hostName.$COMPANY_DOMAIN
ORDERER_CONTAINER=$container_name.$COMPANY_DOMAIN
tls_opts="--tls --cafile $CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/orderers/$orderer_host/tls/ca.crt"
# tls_opts="--tls --cafile /etc/hyperledger/crypto-config/ordererOrganizations/delphi.com/orderers/ordercontainername.delphi.com/tls/ca.crt

ORDERER_ENDPOINT="$ORDERER_CONTAINER:7050" # Must for channel create or Error: Ordering service endpoint  is not valid or missing
# orderer endpoint should use container port
orderer_opts="-o $ORDERER_ENDPOINT"
CMD="peer channel create -c ${CHANNEL_ID,,} $orderer_opts -f $CONTAINER_CONFIGTX_DIR/$COMPANY.channel"
if [ $TLS_ENABLED = true ]; then
	CMD="$CMD $tls_opts"
fi


#docker exec -ti $PEER_CONTAINER sh -c "test -e $CONTAINER_CONFIGTX_DIR/$COMPANY.channel; echo \$?"

echo ===start channel create
echo CMD : $CMD
# ?? still see  WARN: Error reading from stream: rpc error: code = Canceled desc = context canceled

docker exec -ti $PEER_CONTAINER sh -c "$CMD"

