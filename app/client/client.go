package client

import (
	"context"
	"fmt"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/golang/protobuf/proto"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	"github.com/hyperledger/fabric-protos-go/common"
	"github.com/hyperledger/fabric-protos-go/peer"
	"github.com/hyperledger/fabric/protoutil"
)

func InitOrPanic(config tape.CryptoConfig) *tape.Crypto {
	cryptoObject, err := golang.LoadCryptoFrom(config)
	goutils.PanicError(err)
	return cryptoObject
}

func ReadPEMFile(file string) []byte {
	byteSlice, err := goutils.ReadFile(file)
	goutils.PanicError(err)
	return byteSlice
}
func GetProposalSigned(proposal string, signer *tape.Crypto) (signedBytes []byte) {
	var bytes = model.BytesFromString(proposal)
	var signature, err = signer.Sign(bytes)
	goutils.PanicError(err)

	var signed = peer.SignedProposal{
		ProposalBytes: bytes,
		Signature:     signature,
	}
	signedBytes, err = proto.Marshal(&signed)
	goutils.PanicError(err)
	return
}
func CommitProposalAndSign(proposal string, signedBytes []byte, endorsers []model.Node, signer tape.Crypto) []byte {
	_, payload := Propose(proposal, signedBytes, endorsers)
	// sign the payload
	sig, err := signer.Sign(payload)
	goutils.PanicError(err)
	// here's the envelope
	var envelop = common.Envelope{Payload: payload, Signature: sig}
	return protoutil.MarshalOrPanic(&envelop)
}
func QueryProposal(proposal string, signedBytes []byte, endorsers []model.Node) string {
	parsedResult, _ := Propose(proposal, signedBytes, endorsers)
	// TODO think of a reducer with validation
	for _, proposalResponse := range parsedResult {
		if proposalResponse.Response.Status != 200 {
			panic(proposalResponse.Response.Message)
		}
		return model.ShimResultFrom(proposalResponse).Payload
	}
	panic("no proposalResponses found")
}

type GetTransactionByIDResult struct {
	Transaction *common.Payload

	Validation string
}

func (GetTransactionByIDResult) FromString(str string) GetTransactionByIDResult {
	var as = peer.ProcessedTransaction{}
	err := proto.Unmarshal([]byte(str), &as)
	goutils.PanicError(err)
	var result = GetTransactionByIDResult{}
	result.Transaction = protoutil.UnmarshalPayloadOrPanic(as.TransactionEnvelope.Payload)
	result.Validation = peer.TxValidationCode_name[as.ValidationCode]
	return result
}

type Eventer struct {
	golang.Eventer
}

// TODO support multiple eventer
func EventerFrom(node model.Node) Eventer {

	var node_translated = golang.Node{
		Node: tape.Node{
			Addr:          node.Address,
			TLSCARootByte: model.BytesFromString(node.TLSCARoot),
		},
		SslTargetNameOverride: node.SslTargetNameOverride,
	}
	grpcClient, err := node_translated.AsGRPCClient()
	goutils.PanicError(err)
	return Eventer{golang.EventerFrom(context.Background(), grpcClient)}
}

func (e Eventer) WaitForTx(channel, txid string, signer *tape.Crypto) (txStatus string) {
	var seek = e.AsTransactionListener(txid)
	signedEvent, err := seek.SignBy(channel, signer)
	goutils.PanicError(err)
	_, err = e.SendRecv(signedEvent)
	goutils.PanicError(err)
	return fmt.Sprint(e.ReceiptData)
}
