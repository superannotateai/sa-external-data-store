import { Request, Response, NextFunction } from "express";
import * as SaApi from "../utils/saApi";
import path from "path";
import SafeFunctions from "../utils/functions";
import { SaAuthorizedRequest, SaInternalRequest } from "../types";
import { sendError } from "../utils/errorHandler";
import { Config } from "../utils/config";

const saPathHeaders = Config.saPathHeaders();

/**
 * Middleware to validate and resolve file path.
 * Validates file path; sets req.saFilePath on success.
 *
 * Required headers:
 * - header named by saPathHeaders.SA_TEAM_ID: Team ID
 * - header named by saPathHeaders.SA_PROJECT_ID: Project ID
 * 
 * Optional headers:
 * - header named by saPathHeaders.SA_FILE_PATH: File path
 * - header named by saPathHeaders.SA_FOLDER_ID: Folder ID
 * - header named by saPathHeaders.SA_ITEM_ID: Item ID
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response with error status if validation fails, otherwise calls next()
 */
export const PathValidatorMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    // Get SuperAnnotate access token (set by auth middleware)
    const saAccessToken = (req as SaAuthorizedRequest).saAccessToken;

    // Extract required headers
    const saTeamId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_TEAM_ID]);
    const saProjectId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_PROJECT_ID]);
    
    if (!saTeamId || !saProjectId) {
        sendError(res, 400, "Team ID and Project ID are required", "VALIDATION_MISSING_HEADERS");
        return;
    }
    
    // Extract optional headers
    const saFilePath = req.headers[saPathHeaders.SA_FILE_PATH] as string;
    const saFolderId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_FOLDER_ID]);
    const saItemId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_ITEM_ID]);

    let relativeFilePath;

    // If folder ID and item ID are provided, validate user has annotation access for the folder
    if (saFolderId && saItemId) {
        const perms = await SaApi.SuperAnnotateApi.getAnnotationPermissions(saTeamId, saProjectId, saFolderId, saAccessToken);
        const isWriteRequest = req.method !== "GET" && req.method !== "HEAD";
        const allowed = isWriteRequest ? perms.write : perms.read;
        if (!allowed) {
            sendError(res, 401, "Access to item is denied", "AUTH_ACCESS_DENIED");
            return;
        }
        relativeFilePath = path.join(saFolderId.toString(), saItemId.toString(), "annotation.json");
    } else if (saFilePath) {
        relativeFilePath = saFilePath;
    } else {
        sendError(res, 400, "File path is required", "VALIDATION_MISSING_HEADERS");
        return;
    }

    // Validate and authorize via SuperAnnotate API
    try {
        // Verify if SuperAnnotate item exists
        relativeFilePath = path.join(saTeamId.toString(), saProjectId.toString(), relativeFilePath);

        (req as SaInternalRequest).saFilePath = relativeFilePath;
        // All validations passed, proceed to route handler
        next();
    } catch (error) {
        const authError = error as SaApi.SaAuthError;
        
        if (authError?.error?.name === "AuthException") {
            sendError(res, 401, "Invalid or expired authorization token", "AUTH_INVALID_TOKEN");
            return;
        }
        sendError(res, 500, "Failed to validate authorization");
    }
};