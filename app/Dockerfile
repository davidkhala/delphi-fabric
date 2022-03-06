FROM golang:1.16 as golang
COPY . .
RUN go mod vendor
RUN go build -o /root/app github.com/davidkhala/delphi-fabric/app/main


FROM alpine
COPY --from=golang /root/app /usr/local/bin

CMD ["app"]

