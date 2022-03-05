package app

import (
	"github.com/davidkhala/fabric-common/golang"
	"github.com/davidkhala/goutils/crypto"
	"github.com/davidkhala/goutils/grpc"
	"github.com/gin-gonic/gin"
	"net/http"
)

// PingFabric
// @Router /fabric/ping [post]
// @Produce text/plain
// @Accept json
// @Param address body string true "endpoint like grpc(s)://\<fqdn\> or \<fqdn\>"
// @Param certificate body string true "Certificate in PEM format"
// @Param ssl-target-name-override body string true "pseudo endpoint \<fqdn\>"
// @Success 200 {string} string pong
// @Failure 400 {string} string Bad request
func PingFabric(c *gin.Context) {

	address := c.PostForm("address")
	certificatePEM := c.PostForm("certificate")
	certificate, err := crypto.ParseCertPem([]byte(certificatePEM))
	if err != nil {
		c.String(http.StatusBadRequest, "Bad request: [certificate]")
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
