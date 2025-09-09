#!/bin/bash
echo "Waiting for Kafka to be ready..."
while ! kafka-topics --bootstrap-server kafka:9092 --list > /dev/null 2>&1; do
  sleep 1
done

echo "Creating Kafka topics with proper partitioning..."

kafka-topics --bootstrap-server kafka:9092 --create --if-not-exists --topic generate-llms-txt \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000 \
  --config cleanup.policy=delete

echo "Kafka topics created successfully!"