export peerCaCert=$HOME/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/tlsca/tlsca.astri.org-cert.pem
export peerClientKey=$HOME/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/client/clientKey
export peerClientCert=$HOME/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/client/clientCert
export ordererCaCert=$HOME/Documents/delphi-fabric/config/ca-crypto-config/ordererOrganizations/delphi/tlsca/tlsca.delphi-cert.pem
export ordererClientKey=$HOME/Documents/delphi-fabric/config/ca-crypto-config/ordererOrganizations/delphi/client/clientKey
export ordererClientCert=$HOME/Documents/delphi-fabric/config/ca-crypto-config/ordererOrganizations/delphi/client/clientCert

export prometheusConfigFile=$PWD/prometheus.yml
export dockerNetwork=delphiNetwork
set -e
clean() {
	docker system prune --force
}
up() {
	cd ../../common/operations
	docker-compose up
	cd -
}

$1
