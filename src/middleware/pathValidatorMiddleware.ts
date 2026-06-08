import { Request, Response, NextFunction } from "express";
import * as SaApi from "../utils/saApi";
import SafeFunctions from "../utils/functions";
import { SaAuthorizedRequest, SaInternalRequest } from "../types";
import { AppError, SaApiError } from "../types/errors";
import { sendError } from "../utils/errorHandler";
import { Config } from "../utils/config";
import { isSafeSegment } from "../utils/pathSafety";

const saPathHeaders = Config.saPathHeaders();

/**
 * Resolves the SuperAnnotate item for the request and sets the storage scope.
 *
 * The item is resolved through an authoritative SuperAnnotate lookup
 * (`getItem`), so the on-disk location is derived from SA — never from a
 * client-supplied path. This is the control that prevents IDOR / path
 * injection: a caller can only reach items SA confirms they may access.
 *
 * Required headers:
 * - sa-team-id, sa-project-id, sa-folder-id, sa-item-id
 *
 * On success sets:
 * - req.saScope     = "{teamId}/{projectId}/{folderId}"
 * - req.saItemName  = validated, single-segment SuperAnnotate item name
 *
 * @returns Response with error status if validation fails, otherwise calls next()
 */
export const PathValidatorMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    const saAccessToken = (req as SaAuthorizedRequest).saAccessToken;

    const saTeamId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_TEAM_ID]);
    const saProjectId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_PROJECT_ID]);
    const saFolderId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_FOLDER_ID]);
    const saItemId = SafeFunctions.parseNumericHeader(req.headers[saPathHeaders.SA_ITEM_ID]);
    
    if (!saTeamId || !saProjectId || !saFolderId || !saItemId) {
        sendError(res, 400, "Team, project, folder and item IDs are required", "VALIDATION_MISSING_HEADERS");
        return;
    }

    // 1. Authoritative access check + item name resolution (SA is the policy authority).
    let item;
    try {
        item = await SaApi.SuperAnnotateApi.getItem(saTeamId, saProjectId, saFolderId, saItemId, saAccessToken);
    } catch (error) {
        return sendItemLookupError(res, error);
    }

    // 2. Operation permission. Annotation routes require annotation read/write;
    //    storage (read-only) is gated by item visibility from getItem above.
    const isAnnotationRoute = req.baseUrl.includes("/annotation");
    const isWriteRequest = req.method !== "GET" && req.method !== "HEAD";
    if (isAnnotationRoute) {
        try {
            const perms = await SaApi.SuperAnnotateApi.getAnnotationPermissions(saTeamId, saProjectId, saFolderId, saAccessToken);
            const allowed = isWriteRequest ? perms.write : perms.read;
            if (!allowed) {
                sendError(res, 403, "Access to item is denied", "AUTH_ACCESS_DENIED");
                return;
            }
        } catch (error) {
            return sendItemLookupError(res, error);
        }
    }

    // 3. The item name becomes a filesystem segment: validate it (immutable != fs-safe).
    if (!isSafeSegment(item?.name)) {
        // Server-side data integrity problem; do not leak the offending value.
        sendError(res, 500, "Could not resolve item location", "INTERNAL_ERROR");
        return;
    }

    (req as SaInternalRequest).saScope = `${saTeamId}/${saProjectId}/${saFolderId}`;
    (req as SaInternalRequest).saItemName = item.name;
    next();
};

/**
 * Maps a SuperAnnotate lookup failure to an appropriate HTTP error, based on the
 * upstream HTTP status when available.
 * - 401                         -> 401 invalid/expired token
 * - 403 / 404                   -> 403 access denied (no visibility of the item)
 * - other SA status / transport -> 500
 */
function sendItemLookupError(res: Response, error: unknown): void {
    if (error instanceof AppError) {
        sendError(res, error.statusCode, error.message, error.code);
        return;
    }
    if (error instanceof SaApiError) {
        if (error.statusCode === 401) {
            sendError(res, 401, "Invalid or expired authorization token", "AUTH_INVALID_TOKEN");
            return;
        }
        if (error.statusCode === 403 || error.statusCode === 404) {
            sendError(res, 403, "Access to item is denied", "AUTH_ACCESS_DENIED");
            return;
        }
        sendError(res, 500, "Failed to validate authorization", "INTERNAL_ERROR");
        return;
    }
    // Legacy/typed auth-exception body fallback.
    const authError = error as SaApi.SaAuthError;
    if (authError?.error?.name === "AuthException") {
        sendError(res, 401, "Invalid or expired authorization token", "AUTH_INVALID_TOKEN");
        return;
    }
    if (error instanceof Error) {
        // Network / parsing / unexpected failure talking to SuperAnnotate.
        sendError(res, 500, "Failed to validate authorization", "INTERNAL_ERROR");
        return;
    }
    // SuperAnnotate returned an untyped 4xx payload: treat as no access.
    sendError(res, 403, "Access to item is denied", "AUTH_ACCESS_DENIED");
}
