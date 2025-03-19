FROM golang:1.20-alpine as builder

WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o middleware .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/middleware .
COPY .env* .

EXPOSE 8080
CMD ["./middleware"]
