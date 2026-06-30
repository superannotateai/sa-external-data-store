/**
 * Standard error response shape for all API errors
 */
export interface ErrorResponse {
    error: string;
    message: string;
    code?: string;
    timestamp: string;
}

/**
 * Application error with HTTP status and optional client code.
 * Throw in handlers; global error middleware formats and sends the response.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code?: string;

    /**
     * @param message - Human-readable error message
     * @param statusCode - HTTP status code (default 500)
     * @param code - Optional stable client code (e.g. AUTH_INVALID_TOKEN)
     */
    constructor(message: string, statusCode: number = 500, code?: string) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

/**
 * Error thrown by the SuperAnnotate API client when the upstream returns a
 * non-2xx HTTP status. Carries the status code so callers can map it to the
 * correct client-facing response (instead of guessing from the body shape).
 */
export class SaApiError extends Error {
    public readonly statusCode: number;
    public readonly body: unknown;

    constructor(statusCode: number, body: unknown) {
        super(`SuperAnnotate API error (${statusCode})`);
        this.name = "SaApiError";
        this.statusCode = statusCode;
        this.body = body;
        Object.setPrototypeOf(this, SaApiError.prototype);
    }
}

export enum ErrorCode {
    AUTH_MISSING_TOKEN = "AUTH_MISSING_TOKEN",
    AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN",
    VALIDATION_MISSING_HEADERS = "VALIDATION_MISSING_HEADERS",
    VALIDATION_MISSING_PATH = "VALIDATION_MISSING_PATH",
    VALIDATION_INVALID_PATH = "VALIDATION_INVALID_PATH",
    NOT_FOUND_FILE = "NOT_FOUND_FILE",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}
