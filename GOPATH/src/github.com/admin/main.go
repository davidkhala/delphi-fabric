package main

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"strconv"
)

const (
	name = "admincc"
	counterKey="invokeCounter"
)

var logger = shim.NewLogger(name)

type AdminChaincode struct {
}

func (t *AdminChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("###########" + name + " Init ###########")
	// GetStatus in Init will timeout request
	err:=stub.PutState(counterKey, []byte("0"))
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)

}

// Transaction makes payment of X units from A to B
func (t *AdminChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {

	stateBytes,_:=stub.GetState(counterKey)
	state:= string(stateBytes)
	logger.Info("###########" + name + " Invoke :counter "+state+"###########")

	stateInt,_:=strconv.Atoi(state)
	stateInt++
	state=strconv.Itoa(stateInt)
	stub.PutState(counterKey,[]byte(state))
	return shim.Success([]byte(state))
}

func logQueryIterrator(iterator shim.StateQueryIteratorInterface) {
	for {
		if (iterator.HasNext()) {
			kv, _ := iterator.Next()
			logger.Info("kv==", kv);
		} else {
			iterator.Close();
			break;
		}
	}
}

func main() {
	err := shim.Start(new(AdminChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
