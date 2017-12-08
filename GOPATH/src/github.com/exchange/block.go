package main

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"strconv"
)

const (
	name           = "exchange"
	actionLoan     = "loan"
	actionTransfer = "transfer"
)

var logger = shim.NewLogger(name)

type ExchangeChaincode struct {
}

func getBalancekey(stub shim.ChaincodeStubInterface, name string) string {
	exchangeBalanceKey, _ := stub.CreateCompositeKey(name, []string{"balance"});
	return exchangeBalanceKey
}
func (t *ExchangeChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### " + name + " Init ###########")

	//程序启动默认插入1亿个eub
	exchangeBalanceKey := getBalancekey(stub, name)
	stub.PutState(exchangeBalanceKey, []byte("100000000"))

	return shim.Success(nil)

}
func ToInt(bytes []byte) int {
	if bytes==nil{
		return 0
	}
	i, err := strconv.Atoi(string(bytes))
	if err != nil {
		panic(err)
	}
	return i
}
func ToBytes(i int) []byte {
	return []byte(strconv.Itoa(i))
}

// Transaction makes payment of X units from A to B
func (t *ExchangeChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### " + name + " Invoke ###########")

	fcn, args := stub.GetFunctionAndParameters()

	Fuser := args[0]
	fuserBalanceKey := getBalancekey(stub, Fuser)
	fuserBalanceBytes, _ := stub.GetState(fuserBalanceKey)
	if fcn == "balance" {
		return shim.Success(fuserBalanceBytes)
	}
	fuserBalance := ToInt(fuserBalanceBytes)
	Tuser := args[1]
	tuserBalanceKey := getBalancekey(stub, Tuser)
	tuserBalanceBytes, _ := stub.GetState(tuserBalanceKey)
	tuserBalance := ToInt(tuserBalanceBytes)

	switch fcn {
	case actionLoan:

		LoanEub, _ := strconv.Atoi(args[2])

		RealTUserEub := LoanEub / 2 // TODO

		tuserBalance = tuserBalance - RealTUserEub
		fuserBalance = fuserBalance + RealTUserEub

		break
	case actionTransfer:
		EubCount, _ := strconv.Atoi(args[2])
		tuserBalance = tuserBalance - EubCount
		fuserBalance = fuserBalance + EubCount
		break
	default:

	}
	stub.PutState(tuserBalanceKey, ToBytes(tuserBalance))
	stub.PutState(fuserBalanceKey, ToBytes(fuserBalance))

	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(ExchangeChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
