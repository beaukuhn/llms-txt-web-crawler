import { Kafka } from "kafkajs";

let producer: any;

export const setupKafka = async () => {
  const kafka = new Kafka({
    clientId: "api",
    brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
  });

  producer = kafka.producer();

  await producer.connect();

  console.log("Kafka producer connected successfully");

  return producer;
};

export const getProducer = () => {
  if (!producer) {
    throw new Error("Kafka producer not initialized");
  }
  return producer;
};
