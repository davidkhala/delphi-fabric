#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

crypto_config_file="$CURRENT/crypto-config.yaml"

################### company, orgs setting
CONFIG_JSON="$CURRENT/orgs.json"
COMPANY=$1
if [ -z "$COMPANY" ]; then
	echo "missing company param"
	exit 1
fi
orgs=()
remain_params=""
for ((i = 2; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "i:j:" shortname $remain_params; do
	case $shortname in
	i)
		echo "set crypto config yaml file (default: $crypto_config_file) ==> $OPTARG"
		crypto_config_file="$OPTARG"
		;;
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

# build orgs from config.json
p2=$(jq -r ".$COMPANY.orgs|keys[]" $CONFIG_JSON)
if [ "$?" -eq "0" ]; then
	for org in $p2; do
		orgs+=($org)
	done
else
	echo "invalid organization json param:"
	echo "--company: $COMPANY"
	exit 1
fi
COMPANY_DOMAIN=$(jq -r ".$COMPANY.domain" $CONFIG_JSON)

###################
container_name=$(jq -r ".$COMPANY.orderer.containerName" $CONFIG_JSON)
hostName=${container_name,,} # SHOULD be the same with containerName, otherwize TLS problem

rm $crypto_config_file
>$crypto_config_file
yaml w -i $crypto_config_file OrdererOrgs[0].Name OrdererCrytoName
yaml w -i $crypto_config_file OrdererOrgs[0].Domain $COMPANY_DOMAIN
yaml w -i $crypto_config_file OrdererOrgs[0].Specs[0].Hostname ${hostName,,} # be lower case for identity

for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $crypto_config_file PeerOrgs[$i].Name ${orgs[$i]}
	yaml w -i $crypto_config_file PeerOrgs[$i].Domain "${orgs[$i],,}.$COMPANY_DOMAIN"
	yaml w -i $crypto_config_file PeerOrgs[$i].Template.Count 1
	yaml w -i $crypto_config_file PeerOrgs[$i].Template.Start 0
	yaml w -i $crypto_config_file PeerOrgs[$i].Users.Count 0
done
