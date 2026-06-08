import { Request, Response, NextFunction } from "express";
import * as SaApi from "../utils/saApi";
import { SaAuthorizedRequest, ErrorCode } from "../types";
import { SaApiError } from "../types/errors";
import { sendError } from "../utils/errorHandler";
import { Config } from "../utils/config";

const saAuthHeader = Config.saAuthHeader();

/**
 * Middleware to authenticate and authorize requests using SuperAnnotate API
 * 
 * Validates:
 * - Authorization token in SuperAnnotate backend
 * 
 * Required headers:
 * - header named by saAuthHeader: SuperAnnotate access token
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response with error status if validation fails, otherwise calls next()
 */
export const AuthSaMiddleware = async ( req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    // Extract required headers
    const saAccessToken: string | undefined = req.headers[saAuthHeader] as string | undefined;
    // Validate authorization token
    if (!saAccessToken) {
        sendError(res, 401, "API key or authorization token is required", ErrorCode.AUTH_MISSING_TOKEN);
        return;
    }

    // Validate and authorize via SuperAnnotate API
    try {
        // Verify if SuperAnnotate user exists and token is valid
        const user = await SaApi.SuperAnnotateApi.getMySAUser(saAccessToken);
        if (!user || !user.id) {
            sendError(res, 401, "Invalid or expired authorization token", ErrorCode.AUTH_INVALID_TOKEN);
            return;
        }

        (req as SaAuthorizedRequest).saUserId = user.id;
        (req as SaAuthorizedRequest).saAccessToken = saAccessToken;
        // All validations passed, proceed to route handler
        next();
    } catch (error) {
        // Prefer the upstream HTTP status: 401/403 from SuperAnnotate mean the
        // token is invalid or cannot authenticate -> 401, not a server error.
        if (error instanceof SaApiError) {
            if (error.statusCode === 401 || error.statusCode === 403) {
                sendError(res, 401, "Invalid or expired authorization token", ErrorCode.AUTH_INVALID_TOKEN);
                return;
            }
            sendError(res, 500, "Failed to validate authorization", ErrorCode.INTERNAL_SERVER_ERROR);
            return;
        }
        // Legacy/typed auth-exception body fallback.
        const authError = error as SaApi.SaAuthError;
        if (authError?.error?.name === "AuthException") {
            sendError(res, 401, "Invalid or expired authorization token", ErrorCode.AUTH_INVALID_TOKEN);
            return;
        }
        // Transport / unexpected failure talking to SuperAnnotate.
        sendError(res, 500, "Failed to validate authorization", ErrorCode.INTERNAL_SERVER_ERROR);
    }
};