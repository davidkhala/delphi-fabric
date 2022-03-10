package app

import (
	"bytes"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/gin-gonic/gin"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	"github.com/hyperledger/fabric-protos-go/common"
	"github.com/hyperledger/fabric-protos-go/peer"
	"github.com/hyperledger/fabric/protoutil"
	"github.com/pkg/errors"
	"net/http"
)

// CreateProposal
// @Router /fabric/create-proposal [post]
// @Produce json
// @Accept x-www-form-urlencoded
// @Param creator formData string true "Hex-encoded creator bytes"
// @Param channel formData string true "Fabric channel name"
// @Param chaincode formData string true "Fabric chaincode name"
// @Param args formData string true "Fabric chaincode calling args, string array as JSON"
// @Success 200 {object} model.CreateProposalResult
func CreateProposal(c *gin.Context) {

	creator := model.BytesFromForm(c, "creator")
	channel := c.PostForm("channel")
	chaincode := c.PostForm("chaincode")
	var args = []string{}
	goutils.FromJson([]byte(c.PostForm("args")), &args)
	proposal, txid, err := golang.CreateProposal(
		creator,
		channel,
		chaincode,
		"",
		args...,
	)

	goutils.PanicError(err)

	c.JSON(http.StatusOK, model.CreateProposalResult{
		Proposal: model.BytesPacked(protoutil.MarshalOrPanic(proposal)),
		Txid:     txid,
	})
}

func CreateUnSignedTx(proposal *peer.Proposal, responses []*peer.ProposalResponse) ([]byte, error) {
	if len(responses) == 0 {
		return nil, errors.Errorf("at least one proposal response is required")
	}

	// the original header
	hdr, err := tape.GetHeader(proposal.Header)
	if err != nil {
		return nil, err
	}

	// the original payload
	pPayl, err := tape.GetChaincodeProposalPayload(proposal.Payload)
	if err != nil {
		return nil, err
	}

	// get header extensions so we have the visibility field
	_, err = tape.GetChaincodeHeaderExtension(hdr)
	if err != nil {
		return nil, err
	}

	endorsements := make([]*peer.Endorsement, 0)

	// ensure that all actions are bitwise equal and that they are successful
	var a1 []byte
	for n, r := range responses {
		if n == 0 {
			a1 = r.Payload
			if r.Response.Status < 200 || r.Response.Status >= 400 {
				return nil, errors.Errorf("proposal response was not successful, error code %d, msg %s", r.Response.Status, r.Response.Message)
			}
		}
		if bytes.Compare(a1, r.Payload) != 0 {
			return nil, errors.Errorf("ProposalResponsePayloads from Peers do not match")
		}
		endorsements = append(endorsements, r.Endorsement)
	}
	// create ChaincodeEndorsedAction
	cea := &peer.ChaincodeEndorsedAction{ProposalResponsePayload: a1, Endorsements: endorsements}

	// obtain the bytes of the proposal payload that will go to the transaction
	propPayloadBytes, err := protoutil.GetBytesProposalPayloadForTx(pPayl) //, hdrExt.PayloadVisibility
	if err != nil {
		return nil, err
	}

	// serialize the chaincode action payload
	c := &peer.ChaincodeActionPayload{ChaincodeProposalPayload: propPayloadBytes, Action: cea}
	capBytes, err := protoutil.GetBytesChaincodeActionPayload(c)
	if err != nil {
		return nil, err
	}

	// create a transaction
	taa := &peer.TransactionAction{Header: hdr.SignatureHeader, Payload: capBytes}
	taas := make([]*peer.TransactionAction, 1)
	taas[0] = taa
	tx := &peer.Transaction{Actions: taas}
	// serialize the tx
	txBytes, err := protoutil.GetBytesTransaction(tx)
	if err != nil {
		return nil, err
	}

	// create the payload
	payl := &common.Payload{Header: hdr, Data: txBytes}
	paylBytes, err := protoutil.GetBytesPayload(payl)
	if err != nil {
		return nil, err
	}
	return paylBytes, nil

}
