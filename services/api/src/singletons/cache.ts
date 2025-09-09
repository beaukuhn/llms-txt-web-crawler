import { createClient } from 'redis';
import { JobStatus } from '../types';

let redisClient: any;

const REDIS_JOB_STATUS_EXPIRATION = 3600; // 1 hour

export const setupRedis = async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379'
  });

  redisClient.on('error', (err: Error) => console.error('Redis Client Error', err));
  await redisClient.connect();
  
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

export const setJobStatus = async (
  jobId: string,
  status: JobStatus,
  data?: any
) => {
  const redis = getRedisClient();
  
  const jobData = {
    jobId,
    status,
    ...(data || {}),
    updatedAt: Date.now()
  };
  
  await redis.set(
    `job:${jobId}`,
    JSON.stringify(jobData),
    { EX: REDIS_JOB_STATUS_EXPIRATION }
  );
  return jobData;
};

export const getJobStatus = async (
  jobId: string
) => {
  const redis = getRedisClient();
  const data = await redis.get(`job:${jobId}`);
  
  if (!data) return null;
  
  return JSON.parse(data);
}; 