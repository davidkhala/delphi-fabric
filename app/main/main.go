package main

import (
	"github.com/davidkhala/delphi-fabric/app"
	_ "github.com/davidkhala/delphi-fabric/app/docs"
	"github.com/davidkhala/goutils"
	"github.com/davidkhala/goutils/restful"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"os"
)

// @title github.com/davidkhala/delphi-fabric/app
// @version v0.0.0
// @contact.email david-khala@hotmail.com
func main() {

	App := restful.Run(true)
	App.GET("/", restful.Ping)
	App.POST("/fabric/ping", app.PingFabric)
	App.POST("/fabric/create-proposal", app.CreateProposal)
	App.POST("/fabric/transact/process-proposal", app.ProcessProposal)
	App.POST("/fabric/transact/commit", app.Commit)
	App.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler)) // refers to /swagger/*any

	port, exists := os.LookupEnv("PORT")
	if !exists {
		port = "8080"
	}
	goutils.PanicError(App.Run(":" + port))
}
