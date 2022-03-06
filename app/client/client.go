package client

import (
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
