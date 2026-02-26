import { Router, Request, Response } from "express";
import { lookup } from "mime-types";
import { AuthSaMiddleware } from "../middleware/authSaMiddleware";
import { PathValidatorMiddleware } from "../middleware/pathValidatorMiddleware";
import { SaInternalRequest } from "../types";
import { sendError } from "../utils/errorHandler";
import repository from "../repository";

const router = Router();

/**
 * GET /file
 * Serves a file by path after validating signed URL (path, expires, signature).
 * Headers (validated by filePathMiddleware): sa-team-id, sa-project-id, sa-file-path
 * @returns File stream or standardized error response
 */
router.get("/file", AuthSaMiddleware, PathValidatorMiddleware, async (req: Request, res: Response) => {
    const { saFilePath } = (req as SaInternalRequest);
    try {
        console.log("saFilePath", saFilePath);
        const isFileExists = await repository.isFileExists(saFilePath);
        if (!isFileExists) {
            sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
            return;
        }
        const mimeType = lookup(saFilePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        const stream = await repository.getDataStream(saFilePath);
        if (!stream) {
            sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
            return;
        }
        stream.on("error", () => {
            if (!res.headersSent) sendError(res, 500, "Failed to send file");
        });
        stream.pipe(res);
    } catch (error) {
        if (!res.headersSent) {
            sendError(res, 500, "Failed to get data stream");
        }
    }
});

/**
 * GET /fileSigned
 * Serves a file by path after validating signed URL (path, expires, signature).
 * @returns File stream or standardized error response
 */
router.get("/fileSigned", async (req: Request, res: Response) => {
    const { path, expires, signature } = req.query as { path?: string, expires?: string, signature?: string };
    if (!path || !expires || !signature) {
        sendError(res, 400, "Missing required query parameters", "MISSING_QUERY_PARAMETERS");
        return;
    }
    const isValidSignature = await repository.validateSignature(path, expires, signature);
    if (!isValidSignature) {
        sendError(res, 401, "Invalid signature", "INVALID_SIGNATURE");
        return;
    }
    const signedFilePath = decodeURIComponent(path);
    try {
        const isFileExists = await repository.isFileExists(signedFilePath);
        if (!isFileExists) {
            sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
            return;
        }
        const mimeType = lookup(signedFilePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        const stream = await repository.getDataStream(signedFilePath);
        if (!stream) {
            sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
            return;
        }
        stream.on("error", () => {
            if (!res.headersSent) sendError(res, 500, "Failed to send file");
        });
        stream.pipe(res);
    } catch (error) {
        if (!res.headersSent) {
            sendError(res, 500, "Failed to get data stream");
        }
    }
});

/**
 * GET /signedUrl
 * Returns a signed URL for the item identified by SA headers (sa-team-id, sa-project-id, sa-folder-id, sa-item-id).
 * Requires saAuthMiddleware and itemPathMiddleware.
 * @returns 200 with { signedUrl } or error response
 */
router.get("/signedUrl", AuthSaMiddleware, PathValidatorMiddleware, async (req: Request, res: Response) => {
    
    const protocol = req.protocol;
    const hostWithPort = req.get('host'); // e.g., 'localhost:3000'
    const fullUrl = `${protocol}://${hostWithPort}`;

    const { saFilePath } = req as SaInternalRequest;
    
    const isFileExists = await repository.isFileExists(saFilePath);
    if (!isFileExists) {
        sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
        return;
    }
    const signedUrl = await repository.getSignedUrl(saFilePath, fullUrl);
    return res.status(200).json({ signedUrl: signedUrl });
});

export default router;

