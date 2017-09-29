#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"

COMPOSE_FILE="$CURRENT/docker-swarm.yaml"
CONFIG_JSON="$CURRENT/orgs.json"
# TODO if we use cli container to install chaincode, we need to set GOPATH in compose file; here we use node-sdk to do it
GOPATH="$(dirname $CURRENT)/GOPATH/"
IMAGE_TAG="x86_64-1.0.0"

#TODO ledgersData, for resetChaincode CONTAINER_ledgersData="/var/hyperledger/production/ledgersData"

CONTAINER_CONFIGTX_DIR="/etc/hyperledger/configtx"
CONTAINER_CRYPTO_CONFIG_DIR="/etc/hyperledger/crypto-config"
TLS_ENABLED=true

COMPANY=$1
MSPROOT=$2
BLOCK_FILE=$3

remain_params=""
for ((i = 4; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "j:s:v:f:g:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;
	s)
		echo "set TLS_ENABLED string true|false (default: $TLS_ENABLED) ==> $OPTARG"
		TLS_ENABLED=$OPTARG
		;;
	v)
		echo "set docker image version tag (default: $IMAGE_TAG) ==> $OPTARG"
		IMAGE_TAG=$OPTARG
		;;
	f)
		echo "set docker-compose file (default: $COMPOSE_FILE) ==> $OPTARG"
		COMPOSE_FILE=$OPTARG
		;;
	g)
		echo "set GOPATH on host machine (default: $GOPATH) ==> $OPTARG"
		GOPATH=$OPTARG
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

ordererConfig=$(jq -r ".$COMPANY.orderer" $CONFIG_JSON)
orderer_container_name=$(echo $ordererConfig | jq -r ".containerName")
ORDERER_CONTAINER=$orderer_container_name.$COMPANY_DOMAIN

orgsConfig=$(jq -r ".$COMPANY.orgs" $CONFIG_JSON)
orgNames=$(echo $orgsConfig | jq -r "keys[]")

ORDERER_HOST_PORT=$(echo $ordererConfig | jq -r ".portMap[0].host")
ORDERER_CONTAINER_PORT=$(echo $ordererConfig | jq -r ".portMap[0].container")

rm $COMPOSE_FILE
>"$COMPOSE_FILE"

COMPOSE_VERSION=3

yaml w -i $COMPOSE_FILE version \"$COMPOSE_VERSION\" # NOTE it should be a string, only version 3 support network setting

# volumes
docker volume prune --force
volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTX_swarm=$(echo $volumesConfig | jq -r ".CONFIGTX.swarm")
MSPROOT_swarm=$(echo $volumesConfig | jq -r ".MSPROOT.swarm")

yaml w -i $COMPOSE_FILE volumes["$MSPROOT_swarm"].external true
yaml w -i $COMPOSE_FILE volumes["$CONFIGTX_swarm"].external true

networksName="default"

dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)
yaml w -i $COMPOSE_FILE networks["$networksName"].external.name $dockerNetworkName

function serviceNameConvert(){
    # NOTE to fix Error response from daemon: rpc error: code = 3 desc = name must be valid as a DNS name component
    echo $(echo $1| sed 's/\./\-/g')
}
# ccenv: no network is OK;
# NOTE delete ccenv container:swarm will keep restarting dead container
docker pull hyperledger/fabric-ccenv:$IMAGE_TAG

# orderer
ORDERER_SERVICE_NAME="OrdererServiceName.$COMPANY_DOMAIN" # orderer service name will linked to depends_on
ORDERER_SERVICE_NAME=$(serviceNameConvert $ORDERER_SERVICE_NAME)
function envPush() {
	local CMD="$1"
	$CMD.environment[$p] "$2"
	((p++))
}

ORDERERCMD="yaml w -i $COMPOSE_FILE services[${ORDERER_SERVICE_NAME}]"
$ORDERERCMD.image hyperledger/fabric-orderer:$IMAGE_TAG
CONTAINER_GOPATH="/etc/hyperledger/gopath/"

$ORDERERCMD.command "orderer"
$ORDERERCMD.ports[0] $ORDERER_HOST_PORT:$ORDERER_CONTAINER_PORT

p=0
envPush "$ORDERERCMD" ORDERER_GENERAL_LOGLEVEL=debug
envPush "$ORDERERCMD" ORDERER_GENERAL_LISTENADDRESS=0.0.0.0

orderer_hostName_full=$orderer_container_name.$COMPANY_DOMAIN
ORDERER_STRUCTURE="ordererOrganizations/$COMPANY_DOMAIN/orderers/${orderer_hostName_full}"
CONTAINER_ORDERER_TLS_DIR="$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/tls"

envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_ENABLED="$TLS_ENABLED"
envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_PRIVATEKEY=$CONTAINER_ORDERER_TLS_DIR/server.key
envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_CERTIFICATE=$CONTAINER_ORDERER_TLS_DIR/server.crt

envPush "$ORDERERCMD" ORDERER_GENERAL_GENESISMETHOD=file # file|provisional
envPush "$ORDERERCMD" ORDERER_GENERAL_GENESISFILE=$CONTAINER_CONFIGTX_DIR/$(basename $BLOCK_FILE)
# NOTE remove ORDERER_GENERAL_GENESISFILE: panic: Unable to bootstrap orderer. Error reading genesis block file: open /etc/hyperledger/fabric/genesisblock: no such file or directory
# NOTE when ORDERER_GENERAL_GENESISMETHOD=provisional  ORDERER_GENERAL_GENESISPROFILE=SampleNoConsortium -> panic: No system chain found.  If bootstrapping, does your system channel contain a consortiums group definition

# MSP
envPush "$ORDERERCMD" ORDERER_GENERAL_LOCALMSPID=OrdererMSP
envPush "$ORDERERCMD" ORDERER_GENERAL_LOCALMSPDIR=$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/msp
envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_ROOTCAS="[${CONTAINER_ORDERER_TLS_DIR}/ca.crt]" # TODO test

$ORDERERCMD.volumes[0] "$CONFIGTX_swarm:$CONTAINER_CONFIGTX_DIR"
$ORDERERCMD.volumes[1] "$MSPROOT_swarm:$CONTAINER_CRYPTO_CONFIG_DIR"
$ORDERERCMD.networks.$networksName.aliases[0] $orderer_hostName_full

for orgName in $orgNames; do
	orgConfig=$(echo $orgsConfig | jq -r ".$orgName")
	PEER_DOMAIN=$orgName.$COMPANY_DOMAIN
	USER_ADMIN=Admin@$PEER_DOMAIN
	org_peersConfig=$(echo $orgConfig | jq -r ".peers")
	ADMIN_STRUCTURE="peerOrganizations/$PEER_DOMAIN/users/$USER_ADMIN"
	for ((peerIndex = 0; peerIndex < $(echo $org_peersConfig | jq "length"); peerIndex++)); do
		PEER_ANCHOR=peer$peerIndex.$PEER_DOMAIN # TODO multi peer case, take care of any 'peer[0]' occurrence
		peerServiceName=$(serviceNameConvert $PEER_ANCHOR)
		peerConfig=$(echo $org_peersConfig | jq -r ".[$peerIndex]")
		peerContainer=$(echo $peerConfig | jq -r ".containerName").$COMPANY_DOMAIN
		PEER_STRUCTURE="peerOrganizations/$PEER_DOMAIN/peers/$PEER_ANCHOR"
		# peer container
		#
		PEERCMD="yaml w -i $COMPOSE_FILE "services["$peerServiceName"]
		$PEERCMD.depends_on[0] $ORDERER_SERVICE_NAME
		$PEERCMD.image hyperledger/fabric-peer:$IMAGE_TAG
		# NOTE working_dir just setting default commands current path
		$PEERCMD.command "peer node start"
		#common env
		p=0
		envPush "$PEERCMD" CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
		# NOTE docker compose network setting has problem: projectname is configured outside docker but in docker-compose cli
		envPush "$PEERCMD" CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=$dockerNetworkName
		envPush "$PEERCMD" CORE_LOGGING_LEVEL=DEBUG
		envPush "$PEERCMD" CORE_LEDGER_HISTORY_ENABLEHISTORYDATABASE=true

		### GOSSIP setting
		envPush "$PEERCMD" CORE_PEER_GOSSIP_USELEADERELECTION=true
		envPush "$PEERCMD" CORE_PEER_GOSSIP_ORGLEADER=false
		envPush "$PEERCMD" CORE_PEER_GOSSIP_EXTERNALENDPOINT=$PEER_ANCHOR:7051 # NOTE swarm only
		# CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0:7051
		# only work when CORE_PEER_GOSSIP_ORGLEADER=true & CORE_PEER_GOSSIP_USELEADERELECTION=false
		envPush "$PEERCMD" CORE_PEER_LOCALMSPID=${orgName}MSP
		envPush "$PEERCMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/$ADMIN_STRUCTURE/msp
		envPush "$PEERCMD" CORE_PEER_TLS_ENABLED=$TLS_ENABLED
		envPush "$PEERCMD" CORE_PEER_TLS_KEY_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.key
		envPush "$PEERCMD" CORE_PEER_TLS_CERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.crt
		envPush "$PEERCMD" CORE_PEER_TLS_ROOTCERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/ca.crt
		#individual env
		envPush "$PEERCMD" CORE_PEER_ID=$PEER_ANCHOR
		envPush "$PEERCMD" CORE_PEER_ADDRESS=$PEER_ANCHOR:7051

		peerPortMap=$(echo $peerConfig | jq ".portMap")

		for ((j = 0; j < $(echo $peerPortMap | jq "length"); j++)); do
			entry=$(echo $peerPortMap | jq ".[$j]")
			hostPort=$(echo $entry | jq ".host")
			containerPort=$(echo $entry | jq ".container")
			$PEERCMD.ports[$j] $hostPort:$containerPort
		done
		$PEERCMD.volumes[0] "/run/:/host/var/run/"
		$PEERCMD.volumes[1] "$MSPROOT_swarm:$CONTAINER_CRYPTO_CONFIG_DIR" # for peer channel --cafile

		$PEERCMD.networks.$networksName.aliases[0] $PEER_ANCHOR
		#   TODO GO setup failed on peer container: only fabric-tools has go dependencies
		#set GOPATH map
		#
		#   envPush "$PEERCMD" GOPATH=$CONTAINER_GOPATH

		#GOPATH and working_dir conflict: ERROR: for PMContainerName.delphi.com  Cannot start service peer0.pm.delphi.com: oci runtime error: container_linux.go:262: starting container process caused "chdir to cwd (\"/opt/gopath/src/github.com/hyperledger/fabric/peer\") set in config.json failed: no such file or directory"
		#   $PEERCMD.volumes[3] "$GOPATH:$CONTAINER_GOPATH"
	done

	# CA
	CA_enable=$(echo $orgConfig | jq ".ca.enable")
	if [ "$CA_enable" == "true" ]; then
	    caServiceName=$(serviceNameConvert "ca.$PEER_DOMAIN")
		CACMD="yaml w -i $COMPOSE_FILE "services[${caServiceName}]
		$CACMD.image hyperledger/fabric-ca:$IMAGE_TAG
		$CACMD.command "sh -c 'fabric-ca-server start -b admin:adminpw -d'"
		CONTAINER_CA_VOLUME="$CONTAINER_CRYPTO_CONFIG_DIR/peerOrganizations/$PEER_DOMAIN/ca"
		CA_HOST_VOLUME="${MSPROOT}peerOrganizations/$PEER_DOMAIN/ca/" # FIXME not shared volume
		privkeyFilename=$(basename $(find $CA_HOST_VOLUME -type f \( -name "*_sk" \)))
		$CACMD.volumes[0] "$CA_HOST_VOLUME:$CONTAINER_CA_VOLUME"

		p=0
		envPush "$CACMD" "FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server" # align with command
		envPush "$CACMD" "FABRIC_CA_SERVER_CA_CERTFILE=$CONTAINER_CA_VOLUME/ca.$PEER_DOMAIN-cert.pem"
		envPush "$CACMD" "FABRIC_CA_SERVER_TLS_CERTFILE=$CONTAINER_CA_VOLUME/ca.$PEER_DOMAIN-cert.pem"

		envPush "$CACMD" "FABRIC_CA_SERVER_TLS_KEYFILE=$CONTAINER_CA_VOLUME/$privkeyFilename"
		envPush "$CACMD" "FABRIC_CA_SERVER_CA_KEYFILE=$CONTAINER_CA_VOLUME/$privkeyFilename"
		envPush "$CACMD" "FABRIC_CA_SERVER_TLS_ENABLED=$TLS_ENABLED"

		CA_HOST_PORT=$(echo $orgConfig | jq ".ca.portMap[0].host")
		CA_CONTAINER_PORT=$(echo $orgConfig | jq ".ca.portMap[0].container")
		$CACMD.ports[0] $CA_HOST_PORT:$CA_CONTAINER_PORT
		$CACMD.networks[0] $networksName
	fi

done

# NOTE: cli container is just a shadow of any existing peer! see the CORE_PEER_ADDRESS & CORE_PEER_MSPCONFIGPATH

# FIXME testCode to delete: for peer channel update but not working
#CLICMD="yaml w -i $COMPOSE_FILE services.cli"
#$CLICMD.container_name cli.$COMPANY_DOMAIN
#$CLICMD.image hyperledger/fabric-tools:$IMAGE_TAG
#
#p=0
#
#envPush "$CLICMD" CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
#envPush "$CLICMD" CORE_LOGGING_LEVEL=DEBUG
#envPush "$CLICMD" CORE_PEER_ID=cli.$COMPANY_DOMAIN
#envPush "$CLICMD" CORE_PEER_ADDRESS=$ORDERER_CONTAINER:$ORDERER_CONTAINER_PORT
#envPush "$CLICMD" CORE_PEER_LOCALMSPID=OrdererMSP
##envPush "$CLICMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/ordererOrganizations/$COMPANY_DOMAIN/users/Admin@$COMPANY_DOMAIN/msp
#envPush "$CLICMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/msp
#envPush "$CLICMD" CORE_PEER_TLS_ROOTCERT_FILE=$CONTAINER_ORDERER_TLS_DIR/ca.crt
#
#envPush "$CLICMD" GOPATH=$CONTAINER_GOPATH
#
#$CLICMD.volumes[0] /var/run/:/host/var/run/
#$CLICMD.volumes[1] "$MSPROOT:$CONTAINER_CRYPTO_CONFIG_DIR"
#$CLICMD.volumes[2] "$GOPATH:$CONTAINER_GOPATH"
#$CLICMD.command "sleep infinity" # NOTE any kind of hanging is required, otherwise container will not be started when docker-compose up

# NOTE In fabric-tools:
#   cryptogen version: development build
#   configtxgen version: development build
# NOTE tty: indicate terminal connection
