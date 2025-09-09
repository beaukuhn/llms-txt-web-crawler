// src/services/storage.ts - Storage operations for generator content

import { getRedisClient } from "../singletons/redis";
import { getDbPool } from "../singletons/db";
import { RedisClientType } from "redis";
import { Pool } from "pg";
import { JobStatus } from "../types";
import { CACHE_EXPIRATION, JOB_CACHE_EXPIRATION } from "../constants";
import { logError, logInfo } from "../utils/logging";

// Cache clients
let redis: RedisClientType;
let pool: Pool;

/**
 * Gets or initializes the Redis client
 * @returns The Redis client instance
 */
export async function getRedisInstance(): Promise<RedisClientType> {
  if (!redis) {
    redis = await getRedisClient();
  }
  return redis;
}

/**
 * Gets or initializes the database pool
 * @returns The database pool instance
 */
export function getPoolInstance(): Pool {
  if (!pool) {
    pool = getDbPool();
  }
  return pool;
}

/**
 * Updates job status in Redis
 * @param jobId The job ID
 * @param status Current job status
 * @param data Additional job data
 */
export async function updateJobStatus(
  jobId: string,
  status: string,
  data: any = {}
): Promise<void> {
  redis = await getRedisInstance();

  const payload = JSON.stringify({
    jobId,
    status,
    ...data,
    updatedAt: Date.now(),
  });

  await redis.set(`job:${jobId}`, payload, { EX: JOB_CACHE_EXPIRATION });
  logInfo(`Job ${jobId} status updated to ${status}`);
}

/**
 * Retrieves cached content for a URL
 * @param url The URL to retrieve content for
 * @returns Cached content or null if not found
 */
export async function getCached(url: string): Promise<string | null> {
  redis = await getRedisInstance();
  return redis.get(`llms:${url}`);
}

/**
 * Stores generated content in Redis cache
 * @param url The URL for the content
 * @param content The generated content
 */
export async function cacheContent(
  url: string,
  content: string
): Promise<void> {
  redis = await getRedisInstance();
  await redis.set(`llms:${url}`, content, { EX: CACHE_EXPIRATION });
}

/**
 * Persists entry in the database
 * @param url The URL for the entry
 * @param content The content to store
 */
export async function upsertEntry(url: string, content: string): Promise<void> {
  pool = getPoolInstance();

  try {
    await pool.query(
      `
            INSERT INTO llms_entries (url, content)
            VALUES ($1, $2)
            ON CONFLICT (url) DO UPDATE
                SET content = EXCLUDED.content,
                    updated_at = NOW()
        `,
      [url, { llmsTxt: content }]
    );
  } catch (error) {
    logError(`Failed to store entry for ${url}`, error);
    throw error;
  }
}

/**
 * Persists job status in the database
 * @param jobId The job ID
 * @param url The URL being processed
 * @param status Current job status
 * @param error Optional error message
 */
export async function upsertJob(
  jobId: string,
  url: string,
  status: JobStatus,
  error: string | null = null
): Promise<void> {
  pool = getPoolInstance();

  try {
    await pool.query(
      `
            INSERT INTO jobs (id, url, status, error, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE
                SET url = EXCLUDED.url,
                    status = EXCLUDED.status,
                    error = EXCLUDED.error,
                    updated_at = NOW()
        `,
      [jobId, url, status, error, new Date(), new Date()]
    );
  } catch (dbError) {
    logError(`Failed to update job ${jobId} in database`, dbError);
    // Don't rethrow as this is a non-critical operation
  }
}
