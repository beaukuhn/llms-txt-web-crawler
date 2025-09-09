import { Router } from "express";
import { downloadById } from "../controllers/download";

const router = Router();

// Download entry by ID
router.get("/:id", downloadById);

export const downloadRouter = router;
