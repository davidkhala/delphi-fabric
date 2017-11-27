package main

import (
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"strconv"
	"bytes"
	"crypto/x509"
	"encoding/pem"
)

const (
	name       = "admincc"
	counterKey = "invokeCounter"
)

var logger = shim.NewLogger(name)

type AdminChaincode struct {
}

func (t *AdminChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("###########" + name + " Init ###########")
	// GetStatus in Init will timeout request
	err := stub.PutState(counterKey, []byte("0"))
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)

}

type Creator struct {
	Msp         string
	Certificate string
}

func parseCreator(creator []byte) Creator {

	var msp bytes.Buffer

	var certificate bytes.Buffer
	var mspReady bool
	mspReady = false

	for i := 0; i < len(creator); i++ {
		char := creator[i]
		if char < 127 && char > 31 {
			if !mspReady {
				msp.WriteByte(char)
			} else {
				certificate.WriteByte(char)
			}
		} else if char == 10 {
			if (mspReady) {
				certificate.WriteByte(char)
			}
		} else {
			if msp.Len() > 0 {
				mspReady = true
			}

		}
	}
	return Creator{Msp: msp.String(), Certificate: certificate.String()}

}

// Transaction makes payment of X units from A to B
func (t *AdminChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {

	stateBytes, _ := stub.GetState(counterKey)
	state := string(stateBytes)
	logger.Info("###########" + name + " Invoke :counter " + state + "###########")

	creatorBytes, _ := stub.GetCreator()

	creator := parseCreator(creatorBytes)

	block, _ := pem.Decode([]byte(creator.Certificate))
	if block == nil {
		return shim.Success([]byte("pem decode failed:"+creator.Certificate))
	}
	cert, _ := x509.ParseCertificate(block.Bytes)
	logger.Info("issuer")
	logger.Info(cert.Issuer.CommonName)

	logger.Info("subject")
	logger.Info(cert.Subject.CommonName)

	stateInt, _ := strconv.Atoi(state)
	stateInt++
	state = strconv.Itoa(stateInt)
	stub.PutState(counterKey, []byte(state))
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
