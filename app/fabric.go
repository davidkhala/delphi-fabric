package app

import (
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/crypto"
	"github.com/davidkhala/goutils/grpc"
	"github.com/gin-gonic/gin"
	"net/http"
)

type PingBody struct {
	Address               string `json:"address"`
	Certificate           string `json:"certificate"`
	SslTargetNameOverride string `json:"ssl-target-name-override"`
}

// PingFabric
// @Router /fabric/ping [post]
// @Produce text/plain
// @Accept x-www-form-urlencoded
// @Param address formData string true "endpoint like grpc(s)://\<fqdn\> or \<fqdn\>"
// @Param certificate formData string true "Certificate in PEM format. Support hex as secondary format, if you suffer from PEM linebreak issue"
// @Param ssl-target-name-override formData string true "pseudo endpoint \<fqdn\>"
// @Success 200 {string} string pong
// @Failure 400 {string} string Bad request
func PingFabric(c *gin.Context) {

	address := c.PostForm("address")
	certificatePEM := c.PostForm("certificate")

	certificate, err := crypto.ParseCertPem([]byte(certificatePEM))
	if err != nil {
		// support hex as secondary format, due to PEM linebreak issue
		var decoded = goutils.HexDecode(certificatePEM)
		certificate, err = crypto.ParseCertPem(decoded)
		if err != nil {
			c.String(http.StatusBadRequest, "Bad request: [certificate]")
			return
		}
	}
	var param = grpc.Params{
		SslTargetNameOverride: c.DefaultPostForm("ssl-target-name-override", golang.ToAddress(address)),
		Certificate:           certificate,
		WaitForReady:          true,
	}
	_, err = golang.Pings(address, param)

	if err != nil {
		c.String(http.StatusServiceUnavailable, "ServiceUnavailable")
		return
	}
	c.String(http.StatusOK, "pong")
}
