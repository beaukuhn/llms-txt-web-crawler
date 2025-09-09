// src/server.ts -- Implements the webhook endpoint for checking content changes
import express from 'express';
import { createHash } from 'crypto';
import { getRedisClient, closeRedisClient } from './singletons/redis';
import { closeDbPool, getDbPool } from './singletons/db';
import { StatusCodes } from 'http-status-codes';
import { generateLLMsTxt } from './worker';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logInfo, logError } from './utils/logging';
import { getRedisInstance, getPoolInstance } from './services/storage';

const app = express();
const port = process.env.PORT || 3001;

// Initialize Redis connection
async function initializeConnections() {
  const redisClient = await getRedisInstance();
  const pool = getPoolInstance();
  logInfo('Server connections initialized');
}

app.use(express.json());

// Webhook endpoint for checking content changes
app.post('/webhook/check-changes', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'URL is required' });
    }
    
    // Create a unique job ID
    const jobId = `check-${Date.now()}`;
    
    // Generate the content
    await generateLLMsTxt(url, jobId, { force: true });
    
    // Get the generated content from Redis
    const redis = await getRedisInstance();
    const jobData = await redis.get(`job:${jobId}`);
    if (!jobData) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to generate content' });
    }
    
    const { content } = JSON.parse(jobData);
    if (!content) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Generated content is empty' });
    }
    
    // Calculate hash
    const contentHash = createHash('sha256').update(content).digest('hex');
    
    // Get previous hash from database
    const pool = getPoolInstance();
    const hashResult = await pool.query(
      'SELECT content_hash, change_count FROM content_hashes WHERE url = $1',
      [url]
    );
    
    const previousHash = hashResult.rows.length > 0 ? hashResult.rows[0].content_hash : null;
    const changeCount = hashResult.rows.length > 0 ? hashResult.rows[0].change_count : 0;
    const hasChanged = previousHash !== null && previousHash !== contentHash;
    
    // Update or insert the hash
    if (hashResult.rows.length === 0) {
      // First time seeing this URL
      await pool.query(
        `INSERT INTO content_hashes 
         (url, content_hash, metadata) 
         VALUES ($1, $2, $3)`,
        [url, contentHash, { content_length: content.length }]
      );
    } else if (hasChanged) {
      // Content has changed
      await pool.query(
        `UPDATE content_hashes 
         SET content_hash = $1, 
             last_changed = NOW(), 
             last_checked = NOW(),
             change_count = $2,
             is_changed = true,
             metadata = $3,
             updated_at = NOW()
         WHERE url = $4`,
        [contentHash, changeCount + 1, { content_length: content.length }, url]
      );
    } else {
      // Content is the same, just update check time
      await pool.query(
        `UPDATE content_hashes 
         SET last_checked = NOW(),
             updated_at = NOW()
         WHERE url = $1`,
        [url]
      );
    }
    
    res.json({
      url,
      hasChanged,
      previousHash,
      currentHash: contentHash,
      changeCount: hasChanged ? changeCount + 1 : changeCount
    });
    
  } catch (error) {
    logError('Webhook error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

// Endpoint to get all changed content
app.get('/webhook/pending-changes', async (req, res) => {
  try {
    const pool = getPoolInstance();
    const result = await pool.query(
      `SELECT url, content_hash, last_changed, change_count, metadata
       FROM content_hashes
       WHERE is_changed = true
       ORDER BY last_changed DESC`
    );
    
    res.json({
      count: result.rows.length,
      changes: result.rows
    });
  } catch (error) {
    logError('Error fetching pending changes:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Endpoint to mark changes as processed
app.post('/webhook/mark-processed', async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'URLs array is required' });
    }
    
    const pool = getPoolInstance();
    await pool.query(
      `UPDATE content_hashes
       SET is_changed = false
       WHERE url = ANY($1)`,
      [urls]
    );
    
    res.json({ success: true, processed: urls.length });
  } catch (error) {
    logError('Error marking changes as processed:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Add error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Add graceful shutdown handler
process.on('SIGTERM', async () => {
  logInfo('Shutting down server...');
  try {
    await closeRedisClient();
    await closeDbPool();
    logInfo('Server connections closed');
  } catch (error) {
    logError('Error during server shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logInfo('Shutting down server...');
  try {
    await closeRedisClient();
    await closeDbPool();
    logInfo('Server connections closed');
  } catch (error) {
    logError('Error during server shutdown:', error);
  }
  process.exit(0);
});

// Initialize connections before starting the server
initializeConnections().then(() => {
  // Start the server
  app.listen(port, () => {
    logInfo(`Webhook server listening on port ${port}`);
  });
}).catch(error => {
  logError('Failed to initialize server connections:', error);
  process.exit(1);
});

export default app;