package main

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const (
	name = "admincc"
)

var logger = shim.NewLogger(name)

type AdminChaincode struct {
}

func (t *AdminChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("###########" + name + " Init ###########")

	return shim.Success(nil)

}

// Transaction makes payment of X units from A to B
func (t *AdminChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {

	function, args := stub.GetFunctionAndParameters()
	switch function {
	case "chaincode":
		return t.chaincode(stub, args)
	case "channel":
		return t.channel(stub, args)
	}
	logger.Info("###########" + name + " Invoke dummy ###########")
	return shim.Success(nil)
}
func (t *AdminChaincode) channel(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	action := args[0]
	logger.Info("###########" + name + " Invoke:channel:" + action + "###########")

	return shim.Success(nil)
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
func (t *AdminChaincode) chaincode(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	action := args[0]
	logger.Info("###########" + name + " Invoke:chaincode:" + action + " ###########")
	//NOTE stub.GetState(selfChaincode), returning bytes isempty?
	switch action {
	case "test":
		stub.PutState("testKey", []byte("abc"))
	case "reset":
		ccname := args[1]
		err := stub.DelState(ccname)
		logger.Warning(err)
		bytes, err := stub.GetState(ccname)
		logger.Warning("new Bytes")
		logger.Warning(bytes)
		logger.Warning("new err")
		logger.Warning(err)

	case "list":
		queryIterator, _ := stub.GetStateByRange("", "")
		logQueryIterrator(queryIterator)
	}
	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(AdminChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
