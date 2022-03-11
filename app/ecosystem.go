package app

import (
	"github.com/davidkhala/delphi-fabric/app/model"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/http"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	http2 "net/http"
	"net/url"
	"os"
	"time"
)

const (
	FcnCreateToken  = "createToken"
	FcnGetToken     = "getToken"
	FcnTokenHistory = "tokenHistory"
	FcnDeleteToken  = "deleteToken"
	FcnMoveToken    = "moveToken"
)
const chaincode = "ecosystem"

func tokenGenerator() string {
	id := uuid.New()
	return id.String()
}

func BuildURL(str string) string {
	// TODO replace by service discovery
	port, exists := os.LookupEnv("PORT")
	if !exists {
		port = "8080"
	}
	return "http://localhost:" + port + str
}

type CreateTokenResult struct {
	model.CreateProposalResult
	Token string `json:"token"`
}

// CreateToken
// @Param owner formData string true "Token owner"
// @Param content formData string true "Token Content"
// @Param creator formData string true "signer creator in bytes"
// @Param channel formData string true "Fabric channel name"
func CreateToken(c *gin.Context) {
	owner := c.PostForm("owner")
	content := c.PostForm("content")
	var mintTime goutils.TimeLong
	mintTime = mintTime.FromTime(time.Now())

	// Create Proposal
	type TokenCreateRequest struct {
		Owner    string
		MintTime goutils.TimeLong
		Content  []byte
	}

	var request = TokenCreateRequest{
		Owner:    owner,
		MintTime: mintTime,
		Content:  []byte(content),
	}
	var args = []string{FcnCreateToken, string(goutils.ToJson(request))}

	token := tokenGenerator()
	var rawTransient = map[string]string{
		"token": token,
	}

	var body = url.Values{
		"creator":   {c.PostForm("creator")},
		"channel":   {c.PostForm("channel")},
		"chaincode": {chaincode},
		"args":      {string(goutils.ToJson(args))},
		"transient": {string(goutils.ToJson(rawTransient))},
	}
	var _url = BuildURL("/fabric/create-proposal")
	response := http.PostForm(_url, body, nil)
	var result = model.CreateProposalResult{}
	goutils.FromJson(response.BodyBytes(), &result)
	c.JSON(http2.StatusOK, CreateTokenResult{result, token})

}
