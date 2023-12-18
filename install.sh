set -e
CURRENT=$(cd $(dirname ${BASH_SOURCE}) && pwd)

updateChaincode() {

	cd ~
	git clone https://github.com/davidkhala/chaincode.git
	cd -
}

if [[ -n "$1" ]]; then
	"$@"
else
	if [[ -z "$CI" ]]; then
		./gitSync
    cd common

    ./install.sh
    ./install.sh fabricInstall
    cd -

    npm install
    curl --silent --show-error https://raw.githubusercontent.com/davidkhala/goutils/master/scripts/install.sh | bash -s latest
    updateChaincode
	fi


fi
