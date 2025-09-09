export interface GenerateLLMsMessage {
  url: string;
  jobId: string;
  batchId?: string;
  priority?: number;
  source?: string;
  timestamp: number;
  options?: {
    depth?: number;
    includeMetadata?: boolean;
    format?: 'json' | 'text' | 'markdown';
    includePath?: string[];
    excludePath?: string[];
    force?: boolean;
  };
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export const LLMS_TXT_GENERATOR_GROUP = 'llms-generator-group';
export const GENERATE_LLMS_TXT_TOPIC = 'generate-llms-txt';
