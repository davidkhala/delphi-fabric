# fabric-server-go
server entry point

## Swagger Support
To generate swagger docs
1. get binary `swag` by `go install github.com/swaggo/swag/cmd/swag@latest`
2. `swag init -g main/main.go`
3. access swagger: go to `/swagger/index.html`

## Release
CD powered by Github Action.

### Docker
```
docker pull ghcr.io/davidkhala/fabric-server-go:latest
```
### Go Package
 
```
go get github.com/davidkhala/delphi-fabric/app
```
> This would not include server main function, but all (almost) functions and content to build your own server


## Contributor
- language:go 1.16
- Key required modules
  - `github.com/davidkhala/fabric-common/golang`: Wrapper or alternative of fabric-sdk-go. 
  - `github.com/gin-gonic/gin`: The using golang restful API framework
  - `github.com/hyperledger-twgc/tape`: A traffic generator of Fabric for benchmark test. Here, we appreciate its simplicity design and reuse some slim structure  
  - `github.com/hyperledger/fabric`: fabric itself. Used by importing its package `/protoutil`
  - `github.com/davidkhala/goutils`: generic golang utils. Used for grpc, http and other syntax-reform cases
  - `github.com/swaggo/gin-swagger`: The swagger docs generator for gin framework.
- modules for test purpose
  - `github.com/kortschak/utter`: a pretty golang object printer
  - 
