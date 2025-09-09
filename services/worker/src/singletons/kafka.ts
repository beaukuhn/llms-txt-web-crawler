// Kafka singleton pattern
import { Kafka, Consumer, Producer } from "kafkajs";

let kafkaClient: Kafka | null = null;
let kafkaConsumer: Consumer | null = null;
let kafkaProducer: Producer | null = null;

export const getKafkaClient = (): Kafka => {
  if (!kafkaClient) {
    kafkaClient = new Kafka({
      clientId: "worker",
      brokers: [process.env.KAFKA_BROKER || "kafka:9092"],
    });
  }
  return kafkaClient;
};

export const getKafkaConsumer = async (groupId: string): Promise<Consumer> => {
  if (!kafkaConsumer) {
    const kafka = getKafkaClient();
    kafkaConsumer = kafka.consumer({ groupId });
    await kafkaConsumer.connect();
  }
  return kafkaConsumer;
};

export const getKafkaProducer = async (): Promise<Producer> => {
  if (!kafkaProducer) {
    const kafka = getKafkaClient();
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
  }
  return kafkaProducer;
};

export const closeKafkaConnections = async (): Promise<void> => {
  try {
    if (kafkaConsumer) {
      await kafkaConsumer.disconnect();
      kafkaConsumer = null;
    }

    if (kafkaProducer) {
      await kafkaProducer.disconnect();
      kafkaProducer = null;
    }

    console.log("Kafka connections closed");
  } catch (error) {
    console.error("Error closing Kafka connections:", error);
    throw error;
  }
};
