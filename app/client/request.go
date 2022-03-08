package client

// request.go is designed for http request towards server side
import (
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/http"
	"github.com/golang/protobuf/proto"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	"github.com/hyperledger/fabric-protos-go/peer"
	"net/url"
	"os"
)

func BuildURL(route string) string {
	baseUrl, found := os.LookupEnv("BASE_URL")
	if !found {
		baseUrl = "http://localhost:8080"
	}
	return baseUrl + route
}

type QueryParams struct {
	Channel   string
	Chaincode string
	Args      []string
	Endorsers []model.Node
}

func Propose(signer *tape.Crypto, params QueryParams) (map[string]peer.ProposalResponse, *peer.Proposal, string) {
	var creator = signer.Creator

	proposalObject, txid := CreateProposalOrPanic(creator, params.Channel, params.Chaincode, params.Args...)
	var signed = SignProposalOrPanic(proposalObject, signer)
	// Send out
	var _url = BuildURL("/fabric/transact/process-proposal")

	var endorsersInString = string(goutils.ToJson(params.Endorsers))

	signedBytes, err := proto.Marshal(signed)
	goutils.PanicError(err)
	var body = url.Values{
		"endorsers":       {endorsersInString},
		"signed-proposal": {model.BytesResponse(signedBytes)},
	}
	var response = http.PostForm(_url, body, nil) // TODO change to https
	var result = model.ProposalResponseResult{}
	return result.ParseOrPanic(response.BodyBytes()), proposalObject, txid
}
