package client

import (
	"fmt"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/http"
	"github.com/golang/protobuf/proto"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	orderer2 "github.com/hyperledger/fabric-protos-go/orderer"
	"github.com/hyperledger/fabric-protos-go/peer"
	"github.com/kortschak/utter"
	rawHttp "net/http"
	"net/url"
	"testing"
)

func buildURL(route string) string {
	return "http://localhost:8080" + route
}
func TestPing(t *testing.T) {
	var _url = buildURL("/fabric/ping")
	var Certificate = `-----BEGIN CERTIFICATE-----
MIICFzCCAb2gAwIBAgIUS8lAQ16ZG6iTQD7H4E/UQ9d2YrwwCgYIKoZIzj0EAwIw
aDELMAkGA1UEBhMCVVMxFzAVBgNVBAgTDk5vcnRoIENhcm9saW5hMRQwEgYDVQQK
EwtIeXBlcmxlZGdlcjEPMA0GA1UECxMGRmFicmljMRkwFwYDVQQDExBmYWJyaWMt
Y2Etc2VydmVyMB4XDTIyMDMwMzA4MjMwMFoXDTM3MDIyNzA4MjMwMFowaDELMAkG
A1UEBhMCVVMxFzAVBgNVBAgTDk5vcnRoIENhcm9saW5hMRQwEgYDVQQKEwtIeXBl
cmxlZGdlcjEPMA0GA1UECxMGRmFicmljMRkwFwYDVQQDExBmYWJyaWMtY2Etc2Vy
dmVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0qy6fs9TWREZ/vspZMSgjK2X
lHMDcTAikBLmjpp63zxzbNkYYIWZrVlrmpdtV5XWlRIMbDkY+1c/lCStuVT7KaNF
MEMwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQEwHQYDVR0OBBYE
FB6QJa7MCqssjbnQ7Ral4vUGpsVvMAoGCCqGSM49BAMCA0gAMEUCIQDWb+GO0rZ8
vLbOgtIOBwbIcK13Gi2yMb0AIM5ropJTygIgBoOyOOrXcboyjfAiidNvfNTClpSD
4DWMi2X5N0Z5S8k=
-----END CERTIFICATE-----
`

	var body = url.Values{
		"address":                  {"localhost:8051"},
		"certificate":              {Certificate},
		"ssl-target-name-override": {"peer0.icdd"},
	}

	response, err := rawHttp.PostForm(_url, body)
	goutils.PanicError(err)
	utter.Dump(response)
}

var cryptoConfig = tape.CryptoConfig{
	MSPID:    "astriMSP",
	PrivKey:  golang.FindKeyFilesOrPanic("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/users/Admin@astri.org/msp/keystore")[0],
	SignCert: "/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/users/Admin@astri.org/msp/signcerts/Admin@astri.org-cert.pem",
}

var proposalObject *peer.Proposal
var proposalResponses []*peer.ProposalResponse

// prepare value for proposalObject
func TestBuildProposal(t *testing.T) {

	var signer = InitOrPanic(cryptoConfig)
	var channel = "allchannel"
	var _url = buildURL(fmt.Sprintf("/fabric/transact/%s/build-proposal", channel))
	var chaincode = "diagnose"
	var creator = model.BytesResponse(signer.Creator)
	var args = `["whoami"]`
	var body = url.Values{
		"chaincode": {chaincode},
		"creator":   {creator},
		"args":      {args},
	}
	response := http.PostForm(_url, body, nil)

	var dataStruct model.ProposalResult
	var resultBody = response.Trim().Body
	goutils.FromJson([]byte(resultBody), &dataStruct)

	proposalObject = dataStruct.ParseOrPanic()
}
func TestSignProposal(t *testing.T) {
	TestBuildProposal(t)
	var signer = InitOrPanic(cryptoConfig)
	var signed = SignProposalOrPanic(proposalObject, signer)
	// Send out
	var _url = buildURL("/fabric/transact/process-proposal")
	var endorsers = []model.Node{
		{
			Address:               "localhost:8051",
			TLSCARoot:             ReadPEMFile("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/icdd/tlsca/tlsca.icdd-cert.pem"),
			SslTargetNameOverride: "peer0.icdd",
		},
		{
			Address:               "localhost:7051",
			TLSCARoot:             ReadPEMFile("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer0.astri.org/tls/ca.crt"),
			SslTargetNameOverride: "peer0.astri.org",
		},
	}

	var endorsersInString = string(goutils.ToJson(endorsers))

	signedBytes, err := proto.Marshal(signed)
	goutils.PanicError(err)
	var body = url.Values{
		"endorsers":       {endorsersInString},
		"signed-proposal": {model.BytesResponse(signedBytes)},
	}
	var response = http.PostForm(_url, body, nil)
	var result = model.ProposalResponseResult{}
	var parsedResult = result.ParseOrPanic(response.BodyBytes())
	proposalResponses = result.ValuesOf(parsedResult)
}
func TestCreateSignedTx(t *testing.T) {
	TestSignProposal(t)
	var signer = InitOrPanic(cryptoConfig)
	transaction, err := tape.CreateSignedTx(proposalObject, signer, proposalResponses)
	goutils.PanicError(err)

	transactionBytes, err := proto.Marshal(transaction)
	goutils.PanicError(err)
	var orderer = model.Node{
		Address:               "localhost:7050",
		TLSCARoot:             ReadPEMFile("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/ordererOrganizations/hyperledger/orderers/orderer0.hyperledger/tls/ca.crt"),
		SslTargetNameOverride: "orderer0.hyperledger",
	}
	var body = url.Values{
		"orderer":     {string(goutils.ToJson(orderer))},
		"transaction": {model.BytesResponse(transactionBytes)},
	}
	var _url = buildURL("/fabric/transact/commit")
	var response = http.PostForm(_url, body, nil)
	var txResult = &orderer2.BroadcastResponse{}
	goutils.FromJson(response.BodyBytes(), txResult)
	utter.Dump(txResult)
}
