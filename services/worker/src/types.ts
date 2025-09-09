// src/types.ts - Centralized types for the worker

// Job status enum
export enum JobStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Page metadata structure
export interface PageMeta {
  url: string;
  title: string;
  desc: string;
  category?: string; // Optional for backward compatibility
}

// Job options provided to generator
export interface GenerationOptions {
  includePath?: string[];
  excludePath?: string[];
  force?: boolean;
}

// OpenAI enhancement response shape
export interface EnhancementResponse {
  url: string;
  enhancedTitle: string;
  enhancedDescription: string;
}

// Job data stored in cache/status
export interface JobData {
  jobId: string;
  status: JobStatus;
  url?: string;
  content?: string;
  error?: string;
  count?: number;
  warning?: string;
  fromCache?: boolean;
  updatedAt: number;
}

// Re-export constants for convenience
export {
  JOB_CONCURRENCY,
  REQUEST_CONCURRENCY,
  MAX_URLS,
  MAX_DEPTH,
  SITE_REQUEST_TIMEOUT,
  PROCESS_TIMEOUT,
  CACHE_EXPIRATION,
  JOB_CACHE_EXPIRATION,
  LLMS_TXT_GENERATOR_GROUP,
  GENERATE_LLMS_TXT_TOPIC,
  STANDARD_EXCLUDE_PATHS,
} from "./constants";
