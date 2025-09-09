import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { logError } from "../utils/logging";

// central error handler
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logError(`API Error: ${err.message}`, {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    stack: err.stack,
  });

  const statusCode =
    "statusCode" in err && typeof (err as any).statusCode === "number"
      ? (err as any).statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
    status: statusCode,
  });
}

// middleware to catch 404 errors
export function notFoundHandler(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    error: "Not Found",
    status: StatusCodes.NOT_FOUND,
    path: req.originalUrl,
  });
}
