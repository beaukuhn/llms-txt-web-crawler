FROM alpine:latest

WORKDIR /app

COPY ./src/cronjob.sh .
RUN chmod +x cronjob.sh

CMD ["/app/cronjob.sh"] 