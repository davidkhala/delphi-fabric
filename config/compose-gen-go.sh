#!/usr/bin/env bash

CURRENT="$(dirname $(readlink -f $BASH_SOURCE))"
utilsDIR="$(dirname $CURRENT)/common/docker/utils"

COMPOSE_FILE="$CURRENT/docker-compose.yaml"
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

orgsConfig=$(jq -r ".$COMPANY.orgs" $CONFIG_JSON)
orgNames=$(echo $orgsConfig | jq -r "keys[]")

ORDERER_HOST_PORT=$(echo $ordererConfig | jq -r ".portMap[0].host")
ORDERER_CONTAINER_PORT=$(echo $ordererConfig | jq -r ".portMap[0].container")

rm $COMPOSE_FILE
>"$COMPOSE_FILE"

COMPOSE_VERSION=3

yaml w -i $COMPOSE_FILE version \"$COMPOSE_VERSION\" # NOTE it should be a string, only version 3 support network setting

volumesConfig=$(jq -r ".$COMPANY.docker.volumes" $CONFIG_JSON)
CONFIGTXVolume=$(echo $volumesConfig | jq -r ".CONFIGTX.local")
MSPROOTVolume=$(echo $volumesConfig | jq -r ".MSPROOT.local")

# volumes TODO in future we might move process in lifecycle
docker volume prune --force
$utilsDIR/volume.sh createLocal $MSPROOTVolume $MSPROOT
CONFIGTX_DIR=$(dirname $BLOCK_FILE)
$utilsDIR/volume.sh createLocal $CONFIGTXVolume $CONFIGTX_DIR
jq ".$COMPANY.docker.volumes.MSPROOT.dir=\"$MSPROOT\"" $CONFIG_JSON | sponge $CONFIG_JSON
jq ".$COMPANY.docker.volumes.CONFIGTX.dir=\"$CONFIGTX_DIR\"" $CONFIG_JSON | sponge $CONFIG_JSON

yaml w -i $COMPOSE_FILE volumes["$MSPROOTVolume"].external true
yaml w -i $COMPOSE_FILE volumes["$CONFIGTXVolume"].external true

networksName="default"

dockerNetworkName=$(jq -r ".$COMPANY.docker.network" $CONFIG_JSON)
yaml w -i $COMPOSE_FILE networks["$networksName"].external.name $dockerNetworkName

# ccenv: no network is OK
yaml w -i $COMPOSE_FILE services.ccenv.image hyperledger/fabric-ccenv:$IMAGE_TAG
yaml w -i $COMPOSE_FILE services.ccenv.container_name ccenv.$COMPANY_DOMAIN

# orderer
ORDERER_SERVICE_NAME="OrdererServiceName.$COMPANY_DOMAIN" # orderer service name will linked to depends_on

function envPush() {
	local CMD="$1"
	$CMD.environment[$p] "$2"
	((p++))
}

ORDERERCMD="yaml w -i $COMPOSE_FILE services[${ORDERER_SERVICE_NAME}]"
$ORDERERCMD.container_name $orderer_container_name
$ORDERERCMD.image hyperledger/fabric-orderer:$IMAGE_TAG
CONTAINER_GOPATH="/etc/hyperledger/gopath/"

$ORDERERCMD.command "orderer"
$ORDERERCMD.ports[0] $ORDERER_HOST_PORT:$ORDERER_CONTAINER_PORT


orderer_hostName_full=$orderer_container_name.$COMPANY_DOMAIN
ORDERER_STRUCTURE="ordererOrganizations/$COMPANY_DOMAIN/orderers/$orderer_hostName_full"
CONTAINER_ORDERER_TLS_DIR="$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/tls"

$ORDERERCMD.volumes[0] "$CONFIGTXVolume:$CONTAINER_CONFIGTX_DIR"
$ORDERERCMD.volumes[1] "$MSPROOTVolume:$CONTAINER_CRYPTO_CONFIG_DIR"
$ORDERERCMD.networks[0] $networksName

ORDERER_GENERAL_TLS_ROOTCAS="${CONTAINER_ORDERER_TLS_DIR}/ca.crt"
for orgName in $orgNames; do
	orgConfig=$(echo $orgsConfig | jq -r ".$orgName")
	ORG_DOMAIN=$orgName.$COMPANY_DOMAIN
	USER_ADMIN=Admin@$ORG_DOMAIN
	org_peersConfig=$(echo $orgConfig | jq -r ".peers")
	ADMIN_STRUCTURE="peerOrganizations/$ORG_DOMAIN/users/$USER_ADMIN"
	for ((peerIndex = 0; peerIndex < $(echo $org_peersConfig | jq "length"); peerIndex++)); do
		PEER_DOMAIN=peer$peerIndex.$ORG_DOMAIN
		peerServiceName=$PEER_DOMAIN
		peerConfig=$(echo $org_peersConfig | jq -r ".[$peerIndex]")
		peerContainer=$(echo $peerConfig | jq -r ".containerName")
		PEER_STRUCTURE="peerOrganizations/$ORG_DOMAIN/peers/$PEER_DOMAIN"
		# peer container
		#
		PEERCMD="yaml w -i $COMPOSE_FILE "services["$peerServiceName"]
		$PEERCMD.container_name $peerContainer
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
		envPush "$PEERCMD" CORE_PEER_GOSSIP_EXTERNALENDPOINT=$peerContainer:7051
		# CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0:7051
		# only work when CORE_PEER_GOSSIP_ORGLEADER=true & CORE_PEER_GOSSIP_USELEADERELECTION=false
		envPush "$PEERCMD" CORE_PEER_LOCALMSPID=${orgName}MSP
		envPush "$PEERCMD" CORE_PEER_MSPCONFIGPATH=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/msp
		envPush "$PEERCMD" CORE_PEER_TLS_ENABLED=$TLS_ENABLED
		if [ "$TLS_ENABLED" == "true" ]; then
			envPush "$PEERCMD" CORE_PEER_TLS_KEY_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.key
			envPush "$PEERCMD" CORE_PEER_TLS_CERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/server.crt
			envPush "$PEERCMD" CORE_PEER_TLS_ROOTCERT_FILE=$CONTAINER_CRYPTO_CONFIG_DIR/$PEER_STRUCTURE/tls/ca.crt
		fi

		#individual env
		envPush "$PEERCMD" CORE_PEER_ID=$PEER_DOMAIN
		envPush "$PEERCMD" CORE_PEER_ADDRESS=$PEER_DOMAIN:7051

		peerPortMap=$(echo $peerConfig | jq ".portMap")

		for ((j = 0; j < $(echo $peerPortMap | jq "length"); j++)); do
			entry=$(echo $peerPortMap | jq ".[$j]")
			hostPort=$(echo $entry | jq ".host")
			containerPort=$(echo $entry | jq ".container")
			$PEERCMD.ports[$j] $hostPort:$containerPort
		done
		$PEERCMD.volumes[0] "/run/docker.sock:/host/var/run/docker.sock"
		$PEERCMD.volumes[1] "$MSPROOTVolume:$CONTAINER_CRYPTO_CONFIG_DIR" # for peer channel --cafile

		$PEERCMD.networks[0] $networksName
		#   TODO GO setup failed on peer container: only fabric-tools has go dependencies
	done

	# CA
	caConfig=$(echo $orgConfig | jq ".ca")

	CA_enable=$(echo $caConfig | jq ".enable")
	if [ "$CA_enable" == "true" ]; then

		function caGen() {
			local TLS_ENABLED=$1
			#	Config setting: https://hyperledger-fabric-ca.readthedocs.io/en/latest/serverconfig.html
			CONTAINER_CA_HOME="/etc/hyperledger/fabric-ca-server"
			CONTAINER_CA_VOLUME="$CONTAINER_CA_HOME/$ORG_DOMAIN"
			if [ "$TLS_ENABLED" == "true" ]; then
				tlsPrefix="tlsca"
			else
				tlsPrefix="ca"
			fi

			CA_HOST_VOLUME="${MSPROOT}peerOrganizations/$ORG_DOMAIN"
			caServerConfig="$CA_HOST_VOLUME/$tlsPrefix/fabric-ca-server-config.yaml"

			if [ -f "$caServerConfig" ]; then
				rm $caServerConfig
			fi
			>$caServerConfig
			caPrivkeyFilename=$(basename $(find $CA_HOST_VOLUME/ca -type f \( -name "*_sk" \)))
			tlscaPrivkeyFilename=$(basename $(find $CA_HOST_VOLUME/tlsca -type f \( -name "*_sk" \)))
			CACMD="yaml w -i $COMPOSE_FILE "services["$tlsPrefix.$ORG_DOMAIN"]

			if [ "$TLS_ENABLED" == "true" ]; then
				yaml w -i $caServerConfig tls.certfile "$CONTAINER_CA_VOLUME/tlsca/tlsca.$ORG_DOMAIN-cert.pem"
				yaml w -i $caServerConfig tls.keyfile "$CONTAINER_CA_VOLUME/tlsca/$tlscaPrivkeyFilename"
				caContainerName=$(echo $caConfig | jq ".tlsca.containerName")
				CA_HOST_PORT=$(echo $caConfig| jq ".tlsca.portHost")
				yaml w -i $caServerConfig ca.certfile "$CONTAINER_CA_VOLUME/ca/ca.$ORG_DOMAIN-cert.pem"
			    yaml w -i $caServerConfig ca.keyfile "$CONTAINER_CA_VOLUME/ca/$caPrivkeyFilename"
			else
                caContainerName=$(echo $caConfig | jq ".containerName")
				CA_HOST_PORT=$(echo $caConfig | jq ".portHost")
				yaml w -i $caServerConfig ca.certfile "$CONTAINER_CA_VOLUME/ca/ca.$ORG_DOMAIN-cert.pem"
			    yaml w -i $caServerConfig ca.keyfile "$CONTAINER_CA_VOLUME/ca/$caPrivkeyFilename"
			fi




			# affiliations must be a map with 2-depth
			yaml w -i $caServerConfig affiliations.$orgName[0] client
			yaml w -i $caServerConfig affiliations.$orgName[1] user
			yaml w -i $caServerConfig affiliations.$orgName[2] peer

			yaml w -i $caServerConfig tls.enabled $TLS_ENABLED

			adminName=$(echo $caConfig | jq ".admin.name")
			adminPass=$(echo $caConfig | jq ".admin.pass")
			yaml w -i $caServerConfig registry.identities[0].name $adminName
			yaml w -i $caServerConfig registry.identities[0].pass $adminPass
			yaml w -i $caServerConfig registry.identities[0].type "client"
			yaml w -i $caServerConfig -- registry.identities[0].maxenrollments -1 # see in mikefarah/yaml issues #10
			yaml w -i $caServerConfig registry.identities[0].attrs["hf.Registrar.Roles"] "client,user,peer"
			yaml w -i $caServerConfig registry.identities[0].attrs["hf.Revoker"] true
			yaml w -i $caServerConfig registry.identities[0].attrs["hf.Registrar.DelegateRoles"] "client,user"


			p=0
			envPush "$CACMD" "FABRIC_CA_HOME=$CONTAINER_CA_VOLUME/$tlsPrefix" # align with command

			$CACMD.container_name $caContainerName
			$CACMD.networks[0] $networksName
			$CACMD.image hyperledger/fabric-ca:$IMAGE_TAG
			$CACMD.command "sh -c 'fabric-ca-server start -d'"
			$CACMD.volumes[0] "$CA_HOST_VOLUME:$CONTAINER_CA_VOLUME"
			$CACMD.ports[0] $CA_HOST_PORT:7054
		}
		caGen $TLS_ENABLED
		if [ "$TLS_ENABLED" == "true" ]; then
			CONTAINER_tlscaCert="$CONTAINER_CRYPTO_CONFIG_DIR/peerOrganizations/$ORG_DOMAIN/tlsca/tlsca.$ORG_DOMAIN-cert.pem"
			ORDERER_GENERAL_TLS_ROOTCAS="$ORDERER_GENERAL_TLS_ROOTCAS,$CONTAINER_tlscaCert"
		fi
	fi

done

p=0
envPush "$ORDERERCMD" ORDERER_GENERAL_LOGLEVEL=debug
envPush "$ORDERERCMD" ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_ENABLED="$TLS_ENABLED"
if [ "$TLS_ENABLED" == "true" ]; then
	envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_PRIVATEKEY=$CONTAINER_ORDERER_TLS_DIR/server.key
	envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_CERTIFICATE=$CONTAINER_ORDERER_TLS_DIR/server.crt
	envPush "$ORDERERCMD" ORDERER_GENERAL_TLS_ROOTCAS="[$ORDERER_GENERAL_TLS_ROOTCAS]" # TODO this is required when using fabric-ca service with tlsca.* root identity to register/enroll identity
fi

envPush "$ORDERERCMD" ORDERER_GENERAL_GENESISMETHOD=file # file|provisional
envPush "$ORDERERCMD" ORDERER_GENERAL_GENESISFILE=$CONTAINER_CONFIGTX_DIR/$(basename $BLOCK_FILE)
# NOTE remove ORDERER_GENERAL_GENESISFILE: panic: Unable to bootstrap orderer. Error reading genesis block file: open /etc/hyperledger/fabric/genesisblock: no such file or directory
# NOTE when ORDERER_GENERAL_GENESISMETHOD=provisional  ORDERER_GENERAL_GENESISPROFILE=SampleNoConsortium -> panic: No system chain found.  If bootstrapping, does your system channel contain a consortiums group definition

# MSP
envPush "$ORDERERCMD" ORDERER_GENERAL_LOCALMSPID=OrdererMSP
envPush "$ORDERERCMD" ORDERER_GENERAL_LOCALMSPDIR=$CONTAINER_CRYPTO_CONFIG_DIR/$ORDERER_STRUCTURE/msp


# NOTE: cli container is just a shadow of any existing peer! see the CORE_PEER_ADDRESS & CORE_PEER_MSPCONFIGPATH

# NOTE In fabric-tools:
#   cryptogen version: development build
#   configtxgen version: development build
# NOTE tty: indicate terminal connection
