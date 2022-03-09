package client

import (
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
	var Certificate = ReadPEMFile("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/icdd/tlsca/tlsca.icdd-cert.pem")

	var body = url.Values{
		"address":                  {"localhost:8051"},
		"certificate":              {Certificate},
		"ssl-target-name-override": {"peer0.icdd"},
	}

	response, err := rawHttp.PostForm(_url, body)
	goutils.PanicError(err)
	utter.Dump(response.Status)
}

var cryptoConfig = tape.CryptoConfig{
	MSPID:    "astriMSP",
	PrivKey:  golang.FindKeyFilesOrPanic("/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/users/Admin@astri.org/msp/keystore")[0],
	SignCert: "/home/davidliu/Documents/delphi-fabric/config/ca-crypto-config/peerOrganizations/astri.org/users/Admin@astri.org/msp/signcerts/Admin@astri.org-cert.pem",
}

// client side cache
var proposalObject *peer.Proposal
var proposalResponses []*peer.ProposalResponse
var txid string
var channel = "allchannel"
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

func TestSignProposal(t *testing.T) {
	var signer = InitOrPanic(cryptoConfig)

	var queryParams = QueryParams{
		Channel:   channel,
		Chaincode: "diagnose",
		Args:      []string{"whoami"},
		Endorsers: endorsers,
	}
	proposalResponses, proposalObject, txid = CommitProposal(signer, queryParams)

	utter.Dump(txid)

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
func TestEventer_WaitForTx(t *testing.T) {
	TestCreateSignedTx(t)
	var eventer = EventerFrom(endorsers[0])
	var signer = InitOrPanic(cryptoConfig)
	var txStatus = eventer.WaitForTx(channel, txid, signer)
	utter.Dump(txStatus)
}
func TestQueryTx(t *testing.T) {
	if txid == "" {
		txid = "e44f1593bb52025a8817578af500a08381601df8f4c3a6f477449d8a4f975a1b"
	}
	var signer = InitOrPanic(cryptoConfig)
	var channel = "allchannel"
	var queryParams = QueryParams{
		Channel:   channel,
		Chaincode: "qscc",
		Args:      []string{"GetTransactionByID", channel, txid},
		Endorsers: endorsers,
	}

	oneResult := QueryProposal(signer, queryParams)

	var result = GetTransactionByIDResult{}
	result = result.FromString(oneResult)

	utter.Dump(result)
}
