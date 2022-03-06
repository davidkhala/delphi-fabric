package app

import (
	"encoding/json"
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/crypto"
	"github.com/davidkhala/goutils/grpc"
	"github.com/gin-gonic/gin"
	"github.com/golang/protobuf/proto"
	"net/http"
)

// PingFabric
// @Router /fabric/ping [post]
// @Produce text/plain
// @Accept x-www-form-urlencoded
// @Param address formData string true "endpoint like grpc(s)://\<fqdn\> or \<fqdn\>"
// @Param certificate formData string true "Certificate in PEM format. Support hex as secondary format, if you suffer from PEM linebreak issue"
// @Param ssl-target-name-override formData string true "pseudo endpoint \<fqdn\>"
// @Success 200 {string} string pong
// @Failure 400 {string} string Bad request
func PingFabric(c *gin.Context) {

	address := c.PostForm("address")
	certificatePEM := c.PostForm("certificate")

	certificate, err := crypto.ParseCertPem([]byte(certificatePEM))
	if err != nil {
		// support hex as secondary format, due to PEM linebreak issue
		var decoded = goutils.HexDecodeOrPanic(certificatePEM)
		certificate, err = crypto.ParseCertPem(decoded)
		if err != nil {
			c.String(http.StatusBadRequest, "Bad request: [certificate]")
			return
		}
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
// @Router /fabric/ping [post]
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
