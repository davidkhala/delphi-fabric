package app

import (
	"context"
	"encoding/json"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/crypto"
	"github.com/davidkhala/goutils/grpc"
	"github.com/gin-gonic/gin"
	"github.com/golang/protobuf/proto"
	tape "github.com/hyperledger-twgc/tape/pkg/infra"
	"github.com/hyperledger/fabric-protos-go/common"
	"github.com/hyperledger/fabric-protos-go/peer"
	"net/http"
)

// PingFabric
// @Router /fabric/ping [post]
// @Produce text/plain
// @Accept x-www-form-urlencoded
// @Param address formData string true "endpoint like grpc(s)://\<fqdn\> or \<fqdn\>"
// @Param certificate formData string true "Certificate in PEM format. should be in hex format after translation to solve linebreak issue"
// @Param ssl-target-name-override formData string true "pseudo endpoint \<fqdn\>"
// @Success 200 {string} string pong
// @Failure 400 {string} string Bad request
func PingFabric(c *gin.Context) {

	address := c.PostForm("address")
	certificatePEM := model.BytesFromForm(c, "certificate")

	certificate, err := crypto.ParseCertPem(certificatePEM)
	if err != nil {
		c.String(http.StatusBadRequest, "Bad request: [certificate]")
		return
	}
	var param = grpc.Params{
		SslTargetNameOverride: c.DefaultPostForm("ssl-target-name-override", golang.ToAddress(address)),
		Certificate:           certificate,
		WaitForReady:          true,
	}
	_, err = golang.Pings(address, param)

	if err != nil {
		c.String(http.StatusServiceUnavailable, "ServiceUnavailable")
		return
	}
	c.String(http.StatusOK, "pong")
}

// BuildProposal
// @Router /fabric/transact/:channel/build-proposal [post]
// @Produce json
// @Accept x-www-form-urlencoded
// @Param channel path string true "fabric channel name"
// @Param chaincode formData string true "fabric chaincode name"
// @Param creator formData string true "certificate of signer"
// @Param version formData string false "Optional. chaincode version"
// @Param args formData string false "chaincode args, including function name [fcn]"
// @Success 200 {object} model.ProposalResult
func BuildProposal(c *gin.Context) {
	channelName := c.Param("channel")
	chaincode := c.PostForm("chaincode")
	creator := model.BytesFromForm(c, "creator")
	version := c.DefaultPostForm("version", "")
	args := c.DefaultPostForm("args", "[]")
	var arr []string
	err := json.Unmarshal([]byte(args), &arr)
	goutils.PanicError(err)
	proposal, txid, err := golang.CreateProposal(
		creator,
		channelName,
		chaincode,
		version,
		arr...,
	)
	goutils.PanicError(err)
	proposalProto, err := proto.Marshal(proposal)
	goutils.PanicError(err)
	result := model.ProposalResult{
		ProposalProto: model.BytesResponse(proposalProto),
		Txid:          txid,
	}
	c.JSON(http.StatusOK, result)
}

// ProcessProposal
// @Router /fabric/transact/process-proposal [post]
// @Produce json
// @Accept x-www-form-urlencoded
// @Param endorsers formData string true "json data to specify endorsers"
// @Param signed-proposal formData string true "serialized signed-proposal protobuf with hex format"
// @Success 200 {object} model.ProposalResponseResult
func ProcessProposal(c *gin.Context) {
	endorsers := c.PostForm("endorsers")
	signedBytes := model.BytesFromForm(c, "signed-proposal")
	var signed = peer.SignedProposal{}
	err := proto.Unmarshal(signedBytes, &signed)
	goutils.PanicError(err)
	ctx := context.Background()
	proposalResponses := model.ProposalResponseResult{}
	var endorserNodes []model.Node
	goutils.FromJson([]byte(endorsers), &endorserNodes)
	for _, node := range endorserNodes {
		var node_translated = golang.Node{
			Node: tape.Node{
				Addr:          node.Address,
				TLSCARootByte: model.BytesFromString(node.TLSCARoot),
			},
			SslTargetNameOverride: node.SslTargetNameOverride,
		}
		grpcClient, _err := node_translated.AsGRPCClient()
		goutils.PanicError(_err) // TODO use strategy here
		endorserClient := golang.EndorserFrom(grpcClient)
		proposalResponse, _err := endorserClient.ProcessProposal(ctx, &signed)
		goutils.PanicError(_err)
		proposalResponseInBytes, _err := proto.Marshal(proposalResponse)
		goutils.PanicError(_err)
		proposalResponses[node.Address] = model.BytesResponse(proposalResponseInBytes)
	}
	c.JSON(http.StatusOK, proposalResponses)
}

// Commit
// @Router /fabric/transact/commit [post]
// @Produce json
// @Accept x-www-form-urlencoded
// @Param orderer formData string true "json data to specify orderer"
// @Param transaction formData string true "serialized signed proposalResponses as envelop protobuf with hex format"
// @Success 200 {object} model.TxResult
func Commit(c *gin.Context) {
	orderer := c.PostForm("orderer")
	transaction := model.BytesFromForm(c, "transaction")
	var envelop = &common.Envelope{}
	err := proto.Unmarshal(transaction, envelop)
	goutils.PanicError(err)
	var ordererNode model.Node
	goutils.FromJson([]byte(orderer), &ordererNode)

	var node_translated = golang.Node{
		Node: tape.Node{
			Addr:          ordererNode.Address,
			TLSCARootByte: model.BytesFromString(ordererNode.TLSCARoot),
		},
		SslTargetNameOverride: ordererNode.SslTargetNameOverride,
	}
	ordererGrpc, err := node_translated.AsGRPCClient()
	goutils.PanicError(err)
	var committer = golang.Committer{
		AtomicBroadcastClient: golang.CommitterFrom(ordererGrpc),
	}
	err = committer.Setup()
	goutils.PanicError(err)

	txResult, err := committer.SendRecv(envelop)
	goutils.PanicError(err)
	c.JSON(http.StatusOK, txResult)
}
