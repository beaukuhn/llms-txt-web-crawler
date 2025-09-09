import { Router } from "express";
import {
  generateSingleLLMsTxt,
  generateBulkLLMsTxt,
  getJobStatusById,
  getBatchStatus,
} from "../controllers/generate";

const router = Router();

// Single URL generation
router.post("/", generateSingleLLMsTxt);

// Bulk URL processing
router.post("/bulk", generateBulkLLMsTxt);

// Check job status
router.get("/status/:jobId", getJobStatusById);

// Check batch status
router.get("/batch/:batchId", getBatchStatus);

export const generateRouter = router;
