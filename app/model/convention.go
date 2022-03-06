package model

import (
	"github.com/davidkhala/goutils"
	"github.com/gin-gonic/gin"
	"github.com/golang/protobuf/proto"
	"github.com/hyperledger/fabric-protos-go/peer"
)

func BytesFromForm(c *gin.Context, key string) []byte {
	return goutils.HexDecodeOrPanic(c.PostForm(key))
}
func BytesResponse(data []byte) string {
	return goutils.HexEncode(data)
}

type ProposalResult struct {
	ProposalProto string `json:"proposal-proto"`
	Txid          string `json:"txid"`
}

func (result ProposalResult) ParseOrPanic() (proposal *peer.Proposal) {
	err := proto.Unmarshal(goutils.HexDecodeOrPanic(result.ProposalProto), proposal)
	goutils.PanicError(err)
	return
}
