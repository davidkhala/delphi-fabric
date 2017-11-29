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
	"encoding/json"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
	"bytes"
	"encoding/pem"
	"crypto/x509"
	"errors"
)

const (
	TODO      = "TODO"
	Submitted = "Submitted"
	Confirmed = "Confirmed"
	Reject    = "Reject"
	Closed    = "Closed"
)

var logger = shim.NewLogger("vendor_cc")

type Project struct {
	//for party A
	Title       string
	StackHolder []string
	Requirement []string
	Schedule    []Step
}
type Submit struct {
	DeliveryURL string
	ID          string
}
type Step struct {
	//for party A
	Installment int
	ID          string
	DeadLine    string
	Status      string
	lastSubmit  Submit
	lastAudit   Audit
	lastReview  Review
}
type Audit struct {
	ID      string
	Status  string
	Comment string
	Time    string
}
type Review struct {
	Status  string
	Comment string
	ID      string
	Time    string
}
type SimpleChaincode struct {
}

type Creator struct {
	Msp         string
	Certificate string
}

const Schedule = "Schedule"

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
func parseCert(creator Creator) (*x509.Certificate, error) {
	block, _ := pem.Decode([]byte(creator.Certificate))
	if block == nil {
		return nil, errors.New("pem decode failed:" + creator.Certificate)
	}
	return x509.ParseCertificate(block.Bytes)
}

const partASubject = "Admin@BU.Delphi.com"
const partBSubject = "Admin@ENG.Delphi.com"
const partCSubject = "Admin@PM.Delphi.com"

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### vendor Init ###########")

	var err error;
	creatorBytes, _ := stub.GetCreator()
	creator := parseCreator(creatorBytes)
	cert, err := parseCert(creator)
	if err != nil {
		return shim.Error(err.Error())
	}
	if cert.Subject.CommonName != partASubject {
		return shim.Error("invalid creator:" + cert.Subject.CommonName + "; allowed creator:" + partASubject)
	}

	_, args := stub.GetFunctionAndParameters()

	if len(args) == 0 {
		return shim.Error("empty params")
	}
	payloadJSON := args[0]
	project := Project{}
	err = json.Unmarshal([]byte(payloadJSON), &project)
	if err != nil {
		return shim.Error(err.Error())
	}

	logger.Info("project")
	logger.Info(project)
	// Initialize the chaincode
	projectTitle := project.Title
	if len(projectTitle) == 0 {
		return shim.Error("empty project Title")
	}
	err = stub.PutState(projectTitle, []byte(payloadJSON))

	if err != nil {
		return shim.Error(err.Error())
	}
	for i := 0; i < len(project.Schedule); i++ {
		step := project.Schedule[i]
		var stepBytes []byte
		stepBytes, err = json.Marshal(step)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = stub.PutState(step.ID, stepBytes)
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	return shim.Success([]byte(payloadJSON))

}

// Transaction makes payment of X units from A to B
func (t *SimpleChaincode) Invoke(chain shim.ChaincodeStubInterface) pb.Response {
	logger.Info("########### vendor Invoke ###########")

	fcn,args := chain.GetFunctionAndParameters()

	if len(args) == 0 {
		return shim.Error("empty params")
	}
	if fcn == "read" {
		// queries an entity state
		return t.read(chain, args)
	}
	if fcn == "progress" {
		return t.progress(chain, args)
	}

	return shim.Error(`Unknown action, check the fcn, got:` + fcn)
}

func (t *SimpleChaincode) progress(chain shim.ChaincodeStubInterface, args []string) pb.Response {

	creatorBytes, _ := chain.GetCreator()
	creator := parseCreator(creatorBytes)
	cert, err := parseCert(creator)
	if err != nil {
		return shim.Error(err.Error())
	}
	payloadJSON := args[0]
	step := Step{}
	var stepBytes []byte
	switch cert.Subject.CommonName {
	case partASubject:
		submit := Submit{}
		err = json.Unmarshal([]byte(payloadJSON), &submit)
		if err != nil {
			return shim.Error(err.Error())
		}
		stepBytes, err = chain.GetState(submit.ID)
		if err != nil {
			return shim.Error(err.Error())
		}

		err = json.Unmarshal(stepBytes, &step)
		if err != nil {
			return shim.Error(err.Error())
		}
		if step.Status != TODO && step.Status != Reject && step.Status != Submitted {
			return shim.Error("Invalid current step. Status:" + step.Status)
		}
		step.lastSubmit = submit

		step.Status = Submitted

	case partBSubject:
		review := Review{}
		err = json.Unmarshal([]byte(payloadJSON), &review)
		if err != nil {
			return shim.Error(err.Error())
		}
		stepBytes, err = chain.GetState(review.ID)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = json.Unmarshal(stepBytes, &step)
		if err != nil {
			return shim.Error(err.Error())
		}
		if step.Status != Submitted {
			return shim.Error("Invalid current step. Status:" + step.Status)
		}
		step.lastReview = review

		step.Status = review.Status

	case partCSubject:
		audit := Audit{}
		err = json.Unmarshal([]byte(payloadJSON), &audit)
		if err != nil {
			return shim.Error(err.Error())
		}
		stepBytes, err = chain.GetState(audit.ID)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = json.Unmarshal(stepBytes, &step)
		if err != nil {
			return shim.Error(err.Error())
		}
		if step.Status != Confirmed {
			return shim.Error("Invalid current step. Status:" + step.Status)
		}
		step.lastAudit = audit

		step.Status = audit.Status

	default:
		return shim.Error("invalid creator:" + cert.Subject.CommonName)
	}
	stepBytes, err = json.Marshal(step)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = chain.PutState(step.ID, stepBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(stepBytes)

}

// Query callback representing the query of a chaincode
func (t *SimpleChaincode) read(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) < 1 {
		return shim.Error("no query target specified")
	}
	target := args[0]
	logger.Info("target",target)
	switch target {
	case "project":
		if len(args) < 2 {
			return shim.Error("no project title specified")
		}
		projectTitle := args[1]
		logger.Info("title",projectTitle)
		project, _ := stub.GetState(projectTitle)
		return shim.Success(project)
	}

	return shim.Success(nil)
}

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		logger.Errorf("Error starting Simple chaincode: %s", err)
	}
}
