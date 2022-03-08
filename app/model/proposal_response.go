package model

import (
	"github.com/hyperledger/fabric-protos-go/peer"
)

type Response struct {
	// A status code that should follow the HTTP status codes.
	Status int32 `protobuf:"varint,1,opt,name=status,proto3" json:"status,omitempty"`
	// A message associated with the response code.
	Message string `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
	// A payload specified by shim.Success()
	Payload string `protobuf:"bytes,3,opt,name=payload,proto3" json:"payload,omitempty"`
}

func ShimResultFrom(response peer.ProposalResponse) Response {
	return Response{
		response.Response.Status,
		response.Response.Message,
		string(response.Response.Payload),
	}

}
