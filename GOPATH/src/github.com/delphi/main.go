/*
Copyright IBM Corp. 2016 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const (
	name = "delphi_cc"
)

var logger = shim.NewLogger(name)

type DelphiChaincode struct {
}

func (t *DelphiChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### " + name + " Init ###########")

	return shim.Success(nil)

}

// Transaction makes payment of X units from A to B
func (t *DelphiChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### " + name + " Invoke ###########")

	return shim.Success(nil)
}

func (t *DelphiChaincode) query(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(DelphiChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
