import express from 'express';
import { generateRouter } from './routes/generate';
import { downloadRouter } from './routes/download';
import { setupKafka, getProducer } from './singletons/kafka';
import { setupRedis, getRedisClient } from './singletons/cache';
import { setupDatabase, getPool } from './singletons/db';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Add CORS middleware before other middleware
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://frontend:3000'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Initialize services - make this async
async function initializeServices() {
  try {
    // Initialize in sequence with proper await
    await setupKafka();
    await setupRedis();
    setupDatabase();
    
    // Routes
    app.use('/generate', generateRouter);
    app.use('/download', downloadRouter);
    
    // Start server after services are initialized
    app.listen(port, () => {
      console.log(`API service listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

initializeServices();

async function shutdown() {
  console.log('Shutting down API service...');
  
  try {
    const producer = getProducer();
    await producer.disconnect();
    console.log('Kafka producer disconnected');
    
    const redis = getRedisClient();
    await redis.disconnect();
    console.log('Redis connection closed');
    
    const pool = getPool();
    await pool.end();
    console.log('Database connections closed');
    
    console.log('All connections closed successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);