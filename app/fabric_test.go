package app

import (
	"github.com/davidkhala/goutils"
	"github.com/kortschak/utter"
	rawHttp "net/http"
	"net/url"
	"testing"
)

func TestPing(t *testing.T) {
	var _url = "http://localhost:8080/fabric/ping"
	var Certificate = `-----BEGIN CERTIFICATE-----
MIICFzCCAb2gAwIBAgIUS8lAQ16ZG6iTQD7H4E/UQ9d2YrwwCgYIKoZIzj0EAwIw
aDELMAkGA1UEBhMCVVMxFzAVBgNVBAgTDk5vcnRoIENhcm9saW5hMRQwEgYDVQQK
EwtIeXBlcmxlZGdlcjEPMA0GA1UECxMGRmFicmljMRkwFwYDVQQDExBmYWJyaWMt
Y2Etc2VydmVyMB4XDTIyMDMwMzA4MjMwMFoXDTM3MDIyNzA4MjMwMFowaDELMAkG
A1UEBhMCVVMxFzAVBgNVBAgTDk5vcnRoIENhcm9saW5hMRQwEgYDVQQKEwtIeXBl
cmxlZGdlcjEPMA0GA1UECxMGRmFicmljMRkwFwYDVQQDExBmYWJyaWMtY2Etc2Vy
dmVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0qy6fs9TWREZ/vspZMSgjK2X
lHMDcTAikBLmjpp63zxzbNkYYIWZrVlrmpdtV5XWlRIMbDkY+1c/lCStuVT7KaNF
MEMwDgYDVR0PAQH/BAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQEwHQYDVR0OBBYE
FB6QJa7MCqssjbnQ7Ral4vUGpsVvMAoGCCqGSM49BAMCA0gAMEUCIQDWb+GO0rZ8
vLbOgtIOBwbIcK13Gi2yMb0AIM5ropJTygIgBoOyOOrXcboyjfAiidNvfNTClpSD
4DWMi2X5N0Z5S8k=
-----END CERTIFICATE-----
`

	var body = url.Values{
		"address":                  {"localhost:8051"},
		"certificate":              {Certificate},
		"ssl-target-name-override": {"peer0.icdd"},
	}

	response, err := rawHttp.PostForm(_url, body)
	goutils.PanicError(err)
	utter.Dump(response)
}
