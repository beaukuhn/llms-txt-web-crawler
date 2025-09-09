// src/constants.ts - Configuration values for the generator worker

// Environment variables with defaults
export const JOB_CONCURRENCY = parseInt(process.env.JOB_CONCURRENCY || '10', 10);
export const REQUEST_CONCURRENCY = parseInt(process.env.REQUEST_CONCURRENCY || '5', 10);
export const MAX_URLS = parseInt(process.env.MAX_URLS || '100', 10);
export const MAX_DEPTH = parseInt(process.env.MAX_DEPTH || '1', 10);

// Timeouts and cache durations
export const SITE_REQUEST_TIMEOUT = 10000; // 10 seconds for HTTP requests
export const PROCESS_TIMEOUT = 300000; // 5 minutes total processing time
export const CACHE_EXPIRATION = 86400; // 1 day in seconds
export const JOB_CACHE_EXPIRATION = 3600; // 1 hour in seconds

// Kafka topics and groups
export const LLMS_TXT_GENERATOR_GROUP = 'llms-generator-group';
export const GENERATE_LLMS_TXT_TOPIC = 'generate-llms-txt';

// Standard exclusion paths
export const STANDARD_EXCLUDE_PATHS = ['/gp/css/*', '/gp/your-account/*']; 