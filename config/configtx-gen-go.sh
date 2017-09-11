#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

configtx_file="$CURRENT/configtx.yaml"

################### company, orgs setting
CONFIG_JSON="$CURRENT/orgs.json"

CHANNEL_NAME="delphiChannel"
COMPANY=$1
MSPROOT=$2
PROFILE_BLOCK=${COMPANY}Genesis # Take care, it is not file!
PROFILE_CHANNEL=$CHANNEL_NAME   # Take care, it is not file!

remain_params=""
for ((i = 3; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done

while getopts "j:i:b:c:" shortname $remain_params; do
	case $shortname in
	j)
		echo "set config json file (default: $CONFIG_JSON) ==> $OPTARG"
		CONFIG_JSON=$OPTARG
		;;

	i)
		echo "set configtx yaml file (default: $configtx_file) ==> $OPTARG"
		configtx_file="$OPTARG"
		;;
	b)
		echo "set block profile (default: $PROFILE_BLOCK) ==> $OPTARG"
		PROFILE_BLOCK="$OPTARG"
		;;
	c)
		echo "set channel profile (default: $PROFILE_CHANNEL) ==> $OPTARG"
		PROFILE_CHANNEL="$OPTARG"
		;;
	?)
		echo "unknown argument"
		exit 1
		;;
	esac
done

companyConfig=$(jq ".$COMPANY" $CONFIG_JSON)
COMPANY_DOMAIN=$(echo $companyConfig | jq -r ".domain")

ordererConfig=$(echo $companyConfig | jq ".orderer")
ORDERER_CONTAINER_PORT=$(echo $ordererConfig | jq -r ".portMap[0].container")
ANCHOR_PEER_CONTAINER_PORT=7051

ORDERER_CONTAINER=$(echo $ordererConfig | jq -r ".containerName").$COMPANY_DOMAIN

rm $configtx_file
>$configtx_file
# block profile

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.OrdererType 'solo'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Addresses[0] $ORDERER_CONTAINER:$ORDERER_CONTAINER_PORT
# containerFullName:container port, see in marbles
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchTimeout '2s'

yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.MaxMessageCount 10
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.AbsoluteMaxBytes '99 MB'
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.BatchSize.PreferredMaxBytes '512 KB'
# TODO: MSP name here is using assumption here, make sure it align with other modules
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].Name $(echo $ordererConfig | jq -r ".MSP.name" )
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].ID $(echo $ordererConfig | jq -r ".MSP.id" )
yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Orderer.Organizations[0].MSPDir "${MSPROOT}ordererOrganizations/$COMPANY_DOMAIN/msp"

orgsConfig=$(echo $companyConfig| jq ".orgs")
blockOrgs=$(echo $orgsConfig | jq -r "keys[]")
echo =====blockorgs $blockOrgs
i=0
for orgName in $blockOrgs; do
    orgConfig=$(echo $orgsConfig |jq -r ".${orgName}")
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].Name ${orgName}MSPName
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].ID ${orgName}MSP
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].MSPDir \
		"${MSPROOT}peerOrganizations/${orgName,,}.$COMPANY_DOMAIN/msp"

	peerContainer=$(echo $orgConfig |jq -r ".peers[0].containerName" ).$COMPANY_DOMAIN

	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Host \
		$peerContainer
	yaml w -i $configtx_file Profiles.$PROFILE_BLOCK.Consortiums.SampleConsortium.Organizations[$i].AnchorPeers[0].Port \
		$ANCHOR_PEER_CONTAINER_PORT

    ((i++))
done

channelOrgs=$(echo $companyConfig | jq -r ".channels.${CHANNEL_NAME}.orgs|keys[]")

echo =====channelOrgs $channelOrgs
# channel profile
yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Consortium SampleConsortium
i=0
for orgName in $channelOrgs; do
	orgConfig=$(echo $orgsConfig |jq -r ".${orgName}")
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].Name $(echo $orgConfig | jq -r ".MSP.name")

	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].ID $(echo $orgConfig | jq -r ".MSP.id")
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].MSPDir "${MSPROOT}peerOrganizations/${orgName,,}.$COMPANY_DOMAIN/msp"

	peerContainer=$(echo $orgConfig | jq -r ".peers[0].containerName").$COMPANY_DOMAIN
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Host $peerContainer
	yaml w -i $configtx_file Profiles.$PROFILE_CHANNEL.Application.Organizations[$i].AnchorPeers[0].Port $ANCHOR_PEER_CONTAINER_PORT
	((i++))
done
