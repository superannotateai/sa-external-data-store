import { Request, Response, NextFunction } from "express";
import { AppError, ErrorResponse } from "../types/errors";

const STATUS_LABELS: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
};

/**
 * Returns the standard label for an HTTP status code
 * @param statusCode - HTTP status code (e.g. 400, 401, 404, 500)
 * @returns Human-readable label (e.g. "Bad Request", "Unauthorized")
 */
export function getStatusLabel(statusCode: number): string {
    return STATUS_LABELS[statusCode] ?? "Error";
}

/**
 * Sends a standardized JSON error response.
 * Use everywhere instead of ad-hoc res.status().json().
 * @param res - Express response object
 * @param statusCode - HTTP status code (e.g. 400, 401, 404, 500)
 * @param message - Human-readable error message
 * @param code - Optional stable client code (e.g. AUTH_MISSING_TOKEN)
 */
export function sendError(
    res: Response,
    statusCode: number,
    message: string,
    code?: string
): void {
    if (res.headersSent) return;
    const payload: ErrorResponse = {
        error: getStatusLabel(statusCode),
        message,
        timestamp: new Date().toISOString(),
    };
    if (code) payload.code = code;
    res.status(statusCode).json(payload);
}

/**
 * Express error middleware: formats AppError or generic Error and sends standard JSON.
 * Register with app.use() after routes.
 * @param err - Caught error (AppError or generic Error)
 * @param _req - Express request object (unused)
 * @param res - Express response object
 * @param _next - Express next function (unused; required for middleware signature)
 */
export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error("Unhandled error:", err);
    if (res.headersSent) return;
    if (err instanceof AppError) {
        sendError(res, err.statusCode, err.message, err.code);
    } else {
        sendError(res, 500, "An unexpected error occurred");
    }
}
