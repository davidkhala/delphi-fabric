# fabric-server-go

server entry point

## Swagger Support
To generate swagger docs
1. get binary `swag` by `go install github.com/swaggo/swag/cmd/swag@latest`
2. `swag init -g main/main.go`
3. access swagger: go to `/swagger/index.html`

## Release
CD powered by Github Action.

### Docker release
```
docker pull ghcr.io/davidkhala/fabric-server-go:latest
```