package model

import (
	"github.com/davidkhala/goutils"
	"github.com/gin-gonic/gin"
	"github.com/golang/protobuf/proto"
	"github.com/hyperledger/fabric-protos-go/peer"
)

func BytesFromForm(c *gin.Context, key string) []byte {
	return BytesFromString(c.PostForm(key))
}
func BytesFromString(str string) []byte {
	return goutils.HexDecodeOrPanic(str)
}
func BytesResponse(data []byte) string {
	return goutils.HexEncode(data)
}

type ProposalResult struct {
	ProposalProto string `json:"proposal-proto"`
	Txid          string `json:"txid"`
}

func (result ProposalResult) ParseOrPanic() *peer.Proposal {
	var proposal = &peer.Proposal{}
	err := proto.Unmarshal(BytesFromString(result.ProposalProto), proposal)
	goutils.PanicError(err)
	return proposal
}

type ProposalResponseResult map[string]string

func (p *ProposalResponseResult) ParseOrPanic(jsonBytes []byte) map[string]peer.ProposalResponse {
	goutils.FromJson(jsonBytes, p)
	var result = map[string]peer.ProposalResponse{}
	for addr, value := range *p {
		var pr = peer.ProposalResponse{}
		err := proto.Unmarshal(BytesFromString(value), &pr)
		goutils.PanicError(err)
		result[addr] = pr
	}
	return result
}

type Node struct {
	Address               string `json:"address"`
	TLSCARoot             string `json:"tlsca-root"`
	SslTargetNameOverride string `json:"ssl-target-name-override"`
}

type TxResult struct {
	Status int32  `json:"status,omitempty"`
	Info   string `json:"info,omitempty"`
}
