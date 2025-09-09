// The best way to do this would be to include an LLM into the flow such that it can
// with better descriptions, titles, and filtering.
import pLimit from "p-limit";
import { getRedisClient, closeRedisClient } from "./singletons/redis";
import { getDbPool, closeDbPool } from "./singletons/db";
import { RedisClientType } from "redis";
import { Pool } from "pg";
import { JobStatus, PageMeta } from "./types";
import { getKafkaConsumer, closeKafkaConnections } from "./singletons/kafka";
import { enhancePageMetadataViaSinglePrompt } from "./llm";

// Import from new modular structure
import { GenerationOptions } from "./types";
import {
  JOB_CONCURRENCY,
  REQUEST_CONCURRENCY,
  MAX_URLS,
  STANDARD_EXCLUDE_PATHS,
  LLMS_TXT_GENERATOR_GROUP,
  GENERATE_LLMS_TXT_TOPIC,
} from "./constants";
import { logInfo, logError, formatError } from "./utils/logging";
import { withTimeout } from "./utils/timeout";
import { createFilter } from "./utils/validation";
import {
  fetchSitemapUrls,
  bfsCrawl,
  enrichBasicMetadata,
  fetchSiteInfo,
  formatLLMsTxt,
} from "./services/processing";
import {
  updateJobStatus,
  getCached,
  cacheContent,
  upsertEntry,
  upsertJob,
} from "./services/storage";

console.log(
  `Worker starting with JOB_CONCURRENCY=${JOB_CONCURRENCY}, REQUEST_CONCURRENCY=${REQUEST_CONCURRENCY}`
);

let redis: RedisClientType;
let pool: Pool;

// Job Processing Queue
const jobQueue = pLimit(JOB_CONCURRENCY);

async function generateLLMsTxt(
  targetUrl: string,
  jobId: string,
  options: GenerationOptions = {}
): Promise<void> {
  try {
    await updateJobStatus(jobId, JobStatus.PROCESSING, { url: targetUrl });

    // Check cache first
    if (!options.force) {
      const cached = await getCached(targetUrl);
      if (cached) {
        await updateJobStatus(jobId, JobStatus.COMPLETED, {
          content: cached,
          fromCache: true,
        });
        return;
      }
    }

    // initialize URL filter
    const baseUrl = new URL(targetUrl).origin;
    const includePaths = options.includePath || [];

    // create the filter
    const excludePaths = [
      ...STANDARD_EXCLUDE_PATHS,
      ...(options.excludePath || []),
    ];
    const filter = createFilter(includePaths, excludePaths);

    // try sitemap-first approach
    let pages: PageMeta[] = [];
    try {
      const sites = await fetchSitemapUrls(baseUrl);
      pages = sites
        .filter(filter)
        .slice(0, MAX_URLS) // Limit to MAX_URLS
        .map((url) => ({ url, title: "", desc: "" }));
      logInfo(
        `Found ${sites.length} total URLs via sitemap, using ${pages.length} after filtering and limiting`
      );
    } catch (error) {
      logInfo(`Sitemap approach failed: ${formatError(error)}`);
    }

    // if sitemap approach failed, fallback to BFS crawl
    if (pages.length === 0) {
      logInfo(`No pages found via sitemap, falling back to crawling`);
      pages = await bfsCrawl(targetUrl, filter);
      logInfo(`Found ${pages.length} URLs via crawling`);
    }

    // enrich page metadata if needed
    pages = await enrichBasicMetadata(pages);

    // Apply OpenAI enhancement if enabled
    const shouldEnhanceWithChatGPT =
      process.env.ENABLE_CHATGPT_ENHANCEMENT === "true";
    if (shouldEnhanceWithChatGPT && pages.length > 0) {
      try {
        logInfo(`Enhancing page titles with ChatGPT for ${pages.length} pages`);
        pages = await enhancePageMetadataViaSinglePrompt(pages);
      } catch (error) {
        logError("Error enhancing page titles with ChatGPT:", error);
        // Continue with original pages if enhancement fails
      }
    }

    // fetch base page info for heading
    const { title: siteTitle, desc: siteDesc } = await fetchSiteInfo(baseUrl);

    // filter out pages with no title
    pages = pages.filter((page) => page.title !== "" && page.title !== "[]");

    // generate the LLMs.txt content
    const llmsTxt = formatLLMsTxt(siteTitle, siteDesc, pages);

    // persist to database and cache
    await upsertEntry(targetUrl, llmsTxt);
    await cacheContent(targetUrl, llmsTxt);

    // Complete job with appropriate status
    if (pages.length > 0) {
      upsertJob(jobId, targetUrl, JobStatus.COMPLETED).then(() => {
        updateJobStatus(jobId, JobStatus.COMPLETED, {
          content: llmsTxt,
          count: pages.length,
        });
      });
      logInfo(`Job ${jobId} completed successfully with ${pages.length} pages`);
    } else {
      // Handle zero pages case
      const warningMessage =
        "Job completed but no valid pages were found after processing and filtering";
      logInfo(warningMessage);
      await updateJobStatus(jobId, JobStatus.COMPLETED, {
        content: llmsTxt,
        count: 0,
        warning: warningMessage,
      });
    }
  } catch (error) {
    // Handle any unexpected errors
    const errorMessage = formatError(error);
    logError(`Job ${jobId} failed:`, error);
    await upsertJob(jobId, targetUrl, JobStatus.FAILED, errorMessage);
    await updateJobStatus(jobId, JobStatus.FAILED, { error: errorMessage });
  }
}

// Kafka Consumer Setup
async function startConsumer(): Promise<void> {
  redis = await getRedisClient();
  pool = getDbPool();

  const consumer = await getKafkaConsumer(LLMS_TXT_GENERATOR_GROUP);

  try {
    await consumer.subscribe({
      topic: GENERATE_LLMS_TXT_TOPIC,
      fromBeginning: true,
    });

    logInfo("Kafka consumer connected and ready to process jobs");

    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          logInfo("Received message with no value, skipping");
          return;
        }

        let data;
        try {
          data = JSON.parse(message.value.toString());
        } catch (error) {
          logError("Failed to parse message:", message.value.toString());
          return; // Skip invalid messages
        }

        const { url, jobId, options } = data;
        logInfo(
          `Received job ${jobId} for URL ${url} - queuing for processing`
        );

        // Process with jobQueue and timeout
        jobQueue(async () => {
          logInfo(`Starting to process job ${jobId} for URL ${url}`);

          try {
            // Process with timeout protection
            await withTimeout(generateLLMsTxt(url, jobId, options));
            logInfo(`Successfully completed job ${jobId}`);
          } catch (error) {
            // Main error handling for the job processing
            logError(`Error processing job ${jobId}:`, error);

            // Update job status to failed
            try {
              await updateJobStatus(jobId, JobStatus.FAILED, {
                error: formatError(error),
              });
            } catch (statusError) {
              logError(
                `Failed to update status for job ${jobId}:`,
                statusError
              );
            }
          }
        }).catch((error) => {
          // This should rarely happen - only if the job queue itself fails
          logError(`Queue error for job ${jobId}:`, error);
        });
      },
    });
  } catch (error) {
    logError("Fatal error in consumer:", error);
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(): Promise<void> {
  logInfo("Shutting down worker...");

  try {
    await closeKafkaConnections();
    await closeRedisClient();
    await closeDbPool();
    logInfo("All connections closed");
  } catch (error) {
    logError("Error during shutdown:", error);
  }

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start Worker if this is the main module
if (require.main === module) {
  startConsumer().catch((error) => {
    logError("Failed to start consumer:", error);
    process.exit(1);
  });
}

export { generateLLMsTxt, startConsumer };
