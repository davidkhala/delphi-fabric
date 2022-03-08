package client

import (
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	"github.com/hyperledger/fabric-protos-go/peer"
)

func InitOrPanic(config tape.CryptoConfig) *tape.Crypto {
	cryptoObject, err := golang.LoadCryptoFrom(config)
	goutils.PanicError(err)
	return cryptoObject
}
func SignProposalOrPanic(proposal *peer.Proposal, signer *tape.Crypto) *peer.SignedProposal {
	signed, err := tape.SignProposal(proposal, signer)
	goutils.PanicError(err)
	return signed
}

func ReadPEMFile(file string) string {
	byteSlice, err := goutils.ReadFile(file)
	goutils.PanicError(err)
	return model.BytesResponse(byteSlice)
}

// CreateProposalOrPanic
func CreateProposalOrPanic(creator []byte, channelName, chaincode string, args ...string) (*peer.Proposal, string) {

	var version = "" // TODO wait for fabric
	proposal, txid, err := golang.CreateProposal(
		creator,
		channelName,
		chaincode,
		version,
		args...,
	)
	goutils.PanicError(err)
	return proposal, txid
}

func CommitProposal(signer *tape.Crypto, params QueryParams) ([]*peer.ProposalResponse, *peer.Proposal, string) {
	var _map, proposal, txid = Propose(signer, params)
	var result []*peer.ProposalResponse
	for _, value := range _map {
		result = append(result, &value)
	}
	return result, proposal, txid
}
func QueryProposal(signer *tape.Crypto, params QueryParams) string {
	parsedResult, _, _ := Propose(signer, params)
	// TODO think of a reducer with validation
	for _, proposalResponse := range parsedResult {
		if proposalResponse.Response.Status != 200 {
			panic(proposalResponse.Response.Message)
		}
		return model.ShimResultFrom(proposalResponse).Payload
	}
	panic("no proposalResponses found")
}
