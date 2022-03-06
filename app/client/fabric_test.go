package client

import (
	"fmt"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/http"
	"github.com/golang/protobuf/proto"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
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

// prepare value for proposalObject
func TestBuildProposal(t *testing.T) {

	var channel = "allchannel"
	var _url = buildURL(fmt.Sprintf("/fabric/transact/%s/build-proposal", channel))
	var chaincode = "diagnose"
	var creator = goutils.HexEncode([]byte(`-----BEGIN CERTIFICATE-----
MIIB6zCCAZGgAwIBAgIUOGZWFq/3C4N2MlPHMYzSoVxDejAwCgYIKoZIzj0EAwIw
aDELMAkGA1UEBhMCVVMxFzAVBgNVBAgTDk5vcnRoIENhcm9saW5hMRQwEgYDVQQK
EwtIeXBlcmxlZGdlcjEPMA0GA1UECxMGRmFicmljMRkwFwYDVQQDExBmYWJyaWMt
Y2Etc2VydmVyMB4XDTIyMDMwMzA4MjMwMFoXDTIzMDMwMzA4MjgwMFowITEPMA0G
A1UECxMGY2xpZW50MQ4wDAYDVQQDEwVBZG1pbjBZMBMGByqGSM49AgEGCCqGSM49
AwEHA0IABP1K9sciVLcXiwMChUVQclZOBQVD8BIArpdfepjpbPtDXL50n5lLuPli
YA0kArhat2vD0DBxWkybzcDZl+U5oN+jYDBeMA4GA1UdDwEB/wQEAwIHgDAMBgNV
HRMBAf8EAjAAMB0GA1UdDgQWBBS/zU0CT3YbeCyFj33IWYOxxo6baTAfBgNVHSME
GDAWgBQB1xtTp96a5Ka5KK4SQKmrVtPCCTAKBggqhkjOPQQDAgNIADBFAiEAt1uv
MaOQU6mH104DznNOSKL6Y4mebgRsqurZeNOp+ukCIF9TR8Aflx1qriNSL1ws/r2i
AZembctiFmYl9uQ2S1Ke
-----END CERTIFICATE-----
`))

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
	utter.Dump(dataStruct)
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
			TLSCARoot:             "/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/icdd/tlsca/tlsca.icdd-cert.pem",
			SslTargetNameOverride: "peer0.icdd",
		},
		{
			Address:               "localhost:7051",
			TLSCARoot:             "/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/peers/peer0.astri.org/tls/ca.crt",
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
	var resultBody = response.Trim().Body
	utter.Dump(resultBody)

}
