#!/usr/bin/env bash

sudo apt-get -qq install -y jq

CURRENT="$(dirname $(readlink -f ${BASH_SOURCE}))"

crypto_config_file="crypto-config.yaml"
company=$1
if [ -z "$company" ]; then
	echo "missing company param"
	exit 1
fi
orgs=()

if [ -z "$2" ]; then
	echo "missing organization param"
	exit 1
fi
if echo $2 | jq '.'; then
	echo "set organization from json $2"
	length=$(echo $2 | jq '.|length')
	for ((i = 0; i < $length; i++)); do
		orgs[i]=$(echo $2 | jq -r ".[$i]")
	done
	echo "organization set to ${orgs[@]}"
else
	echo "invalid organization json param: $2"
	exit 1
fi

hostName="Orderer"
remain_params=""
for ((i = 3; i <= $#; i++)); do
	j=${!i}
	remain_params="$remain_params $j"
done
while getopts "i:h:" shortname $remain_params; do
	case $shortname in
	i)
		echo "set crypto config yaml file (default: $crypto_config_file) ==> $OPTARG"
		crypto_config_file="$OPTARG"
		;;
	h)
		echo "set hostname (default: $HOSTNAME) ==> $OPTARG"
		hostName=$OPTARG
		;;
	?) #当有不认识的选项的时候arg为?
		echo "unknown argument"
		exit 1
		;;
	esac
done

company_domain="${company,,}.com"
rm $crypto_config_file
>$crypto_config_file
yaml w -i $crypto_config_file OrdererOrgs[0].Name OrdererCrytoName
yaml w -i $crypto_config_file OrdererOrgs[0].Domain $company_domain
yaml w -i $crypto_config_file OrdererOrgs[0].Specs[0].Hostname ${hostName,,}

for ((i = 0; i < ${#orgs[@]}; i++)); do
	yaml w -i $crypto_config_file PeerOrgs[$i].Name ${orgs[$i]}
	yaml w -i $crypto_config_file PeerOrgs[$i].Domain "${orgs[$i],,}.$company_domain"
	yaml w -i $crypto_config_file PeerOrgs[$i].Template.Count 1
	yaml w -i $crypto_config_file PeerOrgs[$i].Template.Start 0
	yaml w -i $crypto_config_file PeerOrgs[$i].Users.Count 0
done
