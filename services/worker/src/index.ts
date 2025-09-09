// src/index.ts
import { startConsumer } from './worker';
import './server';
import { logInfo, logError } from './utils/logging';

// Start the consumer
async function start() {
  try {
    await startConsumer();
    logInfo('Kafka consumer started successfully');
  } catch (error) {
    logError('Failed to start Kafka consumer:', error);
    process.exit(1);
  }
}

start().catch(error => {
  logError('Error in main process:', error);
  process.exit(1);
});