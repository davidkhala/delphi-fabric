FROM golang:1.16 as golang
ADD . .
RUN go mod vendor
RUN go build -o app github.com/davidkhala/delphi-fabric/app/main


FROM alpine
COPY --from=golang /app /usr/local/bin

CMD ["app"]

