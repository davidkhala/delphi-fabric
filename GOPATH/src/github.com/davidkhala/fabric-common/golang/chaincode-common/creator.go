package chaincode_common

import (
	"bytes"
	"crypto/x509"
	"encoding/pem"
	"errors"
)

type Creator struct {
	Msp            string
	CertificatePem string
	Certificate    x509.Certificate
}

func ParseCreator(creator []byte) (*Creator, error) {

	var msp bytes.Buffer

	var certificateBuffer bytes.Buffer
	var mspReady bool
	mspReady = false

	for i := 0; i < len(creator); i++ {
		char := creator[i]
		if char < 127 && char > 31 {
			if !mspReady {
				msp.WriteByte(char)
			} else {
				certificateBuffer.WriteByte(char)
			}
		} else if char == 10 {
			if (mspReady) {
				certificateBuffer.WriteByte(char)
			}
		} else {
			if msp.Len() > 0 {
				mspReady = true
			}

		}
	}

	block, rest := pem.Decode(certificateBuffer.Bytes())

	if rest != nil {
		return nil, errors.New("pem decode failed:" + string(rest))
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, errors.New("pem decode failed:" + err.Error())
	}
	return &Creator{Msp: msp.String(), CertificatePem: certificateBuffer.String(), Certificate: *certificate}, nil

}
