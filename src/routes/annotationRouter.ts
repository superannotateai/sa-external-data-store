import { Router, Request, Response } from "express";
import repository from "../repository";
import { SaInternalRequest } from "../types";
import { sendError } from "../utils/errorHandler";
import { AuthSaMiddleware } from "../middleware/authSaMiddleware";
import { PathValidatorMiddleware } from "../middleware/pathValidatorMiddleware";
import { lookup} from "mime-types";

const router = Router();

// Apply authorization middleware to all routes
// This ensures all requests are authenticated and validated
router.use(AuthSaMiddleware);

// Apply path validation middleware to all routes
// This ensures all requests have a valid file path
router.use(PathValidatorMiddleware);

/**
 * GET /dataStream
 * Retrieves a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * - sa-item-id: Item ID
 * 
 * Returns: Stream of data or error response
 */
router.get("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const filePath = (req as SaInternalRequest).saFilePath;

    // Additional validation (should not happen if middleware works correctly)
    if (!filePath) {
        sendError(res, 400, "Invalid or missing required headers", "VALIDATION_MISSING_HEADERS");
        return;
    }

    try {
        const stream = await repository.getDataStream(filePath);

        if (!stream) {
            sendError(res, 404, "Data stream not found", "NOT_FOUND_DATA_STREAM");
            return;
        }

        // Set appropriate headers for streaming response
        const mimeType = lookup(filePath) || "application/octet-stream";
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Transfer-Encoding", "chunked");

        // Stream data to client
        stream.on("data", (chunk: Buffer) => {
            console.log(">>> DATA CHUNK >>>");
            res.write(chunk);
        });

        stream.on("end", () => {
            console.log(">>> END STREAM >>>");
            res.end();
        });

        stream.on("error", (error: Error) => {
            console.error("Stream error:", error);
            if (!res.headersSent) {
                sendError(res, 500, "Error streaming data");
            } else {
                res.end();
            }
        });
    } catch (error) {
        console.error("Error getting data stream:", error);
        if (!res.headersSent) {
            sendError(res, 500, "Failed to get data stream");
        }
    }
});

/**
 * POST /dataStream
 * Uploads a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * - sa-item-id: Item ID
 * 
 * Body: Raw stream data
 * 
 * Returns: Success message or error response
 */
router.post("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const filePath = (req as SaInternalRequest).saFilePath;

    // Additional validation (should not happen if middleware works correctly)
    if (!filePath) {
        sendError(res, 400, "Invalid or missing required headers", "VALIDATION_MISSING_HEADERS");
        return;
    }

    try {
        req.on("error", (error: Error) => {
            console.error("Request stream error:", error);
            if (!res.headersSent) {
                sendError(res, 500, "Error reading request stream");
            }
        });

        // Save the stream to repository
        await repository.saveDataStream(filePath, req);

        res.status(200).json({
            message: "Data stream saved successfully",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error processing data stream:", error);
        if (!res.headersSent) {
            sendError(res, 500, "Failed to process data stream");
        }
    }
});

export default router;

