import { Router, Request, Response } from "express";
import repository from "../repository";
import { SaInternalRequest } from "../types";
import { sendError } from "../utils/errorHandler";
import { AppError } from "../types/errors";
import { AuthSaMiddleware } from "../middleware/authSaMiddleware";
import { PathValidatorMiddleware } from "../middleware/pathValidatorMiddleware";
import { lookup } from "mime-types";

const router = Router();

// Authenticate, then resolve the SuperAnnotate item (sets saScope + saItemName).
router.use(AuthSaMiddleware);
router.use(PathValidatorMiddleware);

/**
 * Builds the items-relative path of the annotation file for the resolved item:
 * {scope}/<item_name>_annotation.json
 */
function annotationPath(req: Request): string {
    const { saScope, saItemName } = req as SaInternalRequest;
    return `${saScope}/${saItemName}_annotation.json`;
}

/**
 * GET /annotation/
 * Streams the annotation file for the resolved SuperAnnotate item.
 * Item identity/access is established by PathValidatorMiddleware.
 */
router.get("/", async (req: Request, res: Response) => {
    const filePath = annotationPath(req);

    try {
        const stream = await repository.getDataStream(filePath);

        if (!stream) {
            sendError(res, 404, "Data stream not found", "NOT_FOUND_DATA_STREAM");
            return;
        }

        const mimeType = lookup(filePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Transfer-Encoding", "chunked");

        stream.on("data", (chunk: Buffer) => {
            res.write(chunk);
        });

        stream.on("end", () => {
            res.end();
        });

        stream.on("error", () => {
            if (!res.headersSent) {
                sendError(res, 500, "Error streaming data");
            } else {
                res.end();
            }
        });
    } catch (error) {
        if (!res.headersSent) {
            if (error instanceof AppError) {
                sendError(res, error.statusCode, error.message, error.code);
                return;
            }
            sendError(res, 500, "Failed to get data stream");
        }
    }
});

/**
 * POST /annotation/
 * Saves the request body stream as the annotation file for the resolved item.
 * Write permission is enforced by PathValidatorMiddleware.
 */
router.post("/", async (req: Request, res: Response) => {
    const filePath = annotationPath(req);

    try {
        req.on("error", () => {
            if (!res.headersSent) {
                sendError(res, 500, "Error reading request stream");
            }
        });

        await repository.saveDataStream(filePath, req);

        res.status(200).json({
            message: "Data stream saved successfully",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        if (!res.headersSent) {
            if (error instanceof AppError) {
                sendError(res, error.statusCode, error.message, error.code);
                return;
            }
            sendError(res, 500, "Failed to process data stream");
        }
    }
});

export default router;
