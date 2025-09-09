import { Request, Response } from 'express';
import { GenerateLLMsMessage, JobStatus, GENERATE_LLMS_TXT_TOPIC } from '../types';
import { setJobStatus, getJobStatus } from '../singletons/cache';
import { getProducer } from '../singletons/kafka';
import { StatusCodes } from 'http-status-codes';

const MAX_BULK_URLS = parseInt(process.env.MAX_BULK_URLS || '100', 10);

// Generate a single LLMs.txt
export const generateSingleLLMsTxt = async (
    req: Request,
    res: Response
): Promise<void> => {
  try {
    // Get the singleton producer
    const producer = getProducer();
    
    const { url, priority, source, options } = req.body;
    
    // Create a unique job ID
    const jobId = Date.now().toString();
    
    // Create message with additional fields
    const message: GenerateLLMsMessage = { 
      url,
      jobId,
      priority: priority || 1,
      source: source || 'api',
      timestamp: Date.now(),
      options
    };
    
    // Set initial job status in Redis
    await setJobStatus(jobId, JobStatus.PENDING, { url });
    
    // Send to Kafka
    await producer.send({
      topic: GENERATE_LLMS_TXT_TOPIC,
      messages: [{ value: JSON.stringify(message) }]
    });
    
    res.json({ 
      status: 'Job queued successfully', 
      jobId 
    });
  } catch (error) {
    console.error('Error queuing job:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to queue job' });
  }
};

// Generate multiple LLMs.txt in bulk
export const generateBulkLLMsTxt = async (
    req: Request,
    res: Response
): Promise<void> => {
  try {
    const { urls, priority, source, options } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'No URLs provided' });
      return;
    }
    
    // Limit to MAX_BULK_URLS
    const urlsToProcess = urls.slice(0, MAX_BULK_URLS);
    const batchId = Date.now().toString(); // Create a batch ID to group these jobs
    const jobs = [];
    
    // Connect to Kafka once
    const producer = getProducer();
    
    // Process each URL
    for (const url of urlsToProcess) {
      // Create a unique job ID with batch reference
      const jobId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Create message
      const message: GenerateLLMsMessage = { 
        url,
        jobId,
        batchId, // Include batch ID
        priority: priority || 1,
        source: source || 'api',
        timestamp: Date.now(),
        options
      };
      
      // Set initial job status in Redis with batch reference
      await setJobStatus(jobId, JobStatus.PENDING, { url, batchId });
      
      // Send to Kafka
      await producer.send({
        topic: GENERATE_LLMS_TXT_TOPIC,
        messages: [{ value: JSON.stringify(message) }]
      });
      
      jobs.push({ jobId, url });
    }
    
    res.json({ 
      status: 'Bulk jobs queued successfully', 
      count: jobs.length,
      batchId,
      jobs
    });
  } catch (error) {
    console.error('Error queuing bulk jobs:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to queue bulk jobs' });
  }
};

// Get status for a single job
export const getJobStatusById = async (
    req: Request,
    res: Response
): Promise<void> => {
  try {
    const { jobId } = req.params;
    const status = await getJobStatus(jobId);
    
    if (!status) {
      res.status(StatusCodes.NOT_FOUND).json({ error: 'Job not found' });
      return;
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to fetch job status' });
  }
};

// Get status for a batch of jobs
export const getBatchStatus = async (
    req: Request,
    res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    
    // TODO: This would require a new cache function to get all jobs by batchId
    
    res.json({
      batchId,
      message: "Batch status functionality to be implemented"
    });
    
  } catch (error) {
    console.error('Error fetching batch status:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to fetch batch status' });
  }
}; 