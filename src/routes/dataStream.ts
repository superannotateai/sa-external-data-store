import { Router, Request, Response } from "express";
import { saItemMiddleware } from "../middleware/auth";
import repository from "../repository";
import SafeFunctions from "../utils/functions";

const router = Router();

// Apply authorization middleware to all routes
// This ensures all requests are authenticated and validated
router.use(saItemMiddleware);

/**
 * GET /dataStream
 * Retrieves a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - sa-item-id: Item ID
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * - sa-file-name: File name
 * 
 * Returns: Stream of data (text/plain) or error response
 */
router.get("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const itemId = SafeFunctions.parseNumericHeader(req.headers["sa-item-id"], "sa-item-id");
    const teamId = SafeFunctions.parseNumericHeader(req.headers["sa-team-id"], "sa-team-id");
    const projectId = SafeFunctions.parseNumericHeader(req.headers["sa-project-id"], "sa-project-id");
    const folderId = SafeFunctions.parseNumericHeader(req.headers["sa-folder-id"], "sa-folder-id");
    const fileName = req.headers["sa-file-name"] as string;

    // Additional validation (should not happen if middleware works correctly)
    if (!itemId || !teamId || !projectId || !folderId || !fileName) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invalid or missing required headers",
            timestamp: new Date().toISOString(),
        });
    }

    try {
        const stream = await repository.getDataStream(teamId, projectId, folderId, itemId, fileName);

        if (!stream) {
            return res.status(404).json({
                error: "Not Found",
                message: "Data stream not found",
                timestamp: new Date().toISOString(),
            });
        }

        // Set appropriate headers for streaming response
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Transfer-Encoding", "chunked");

        // Stream data to client
        stream.on("data", (chunk: Buffer) => {
            res.write(chunk);
        });

        stream.on("end", () => {
            res.end();
        });

        stream.on("error", (error: Error) => {
            console.error("Stream error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "Error streaming data",
                    timestamp: new Date().toISOString(),
                });
            } else {
                // Headers already sent, just end the response
                res.end();
            }
        });
    } catch (error) {
        console.error("Error getting data stream:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: "Internal Server Error",
                message: "Failed to get data stream",
                timestamp: new Date().toISOString(),
            });
        }
    }
});

/**
 * POST /dataStream
 * Uploads a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - sa-item-id: Item ID
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * - sa-file-name: File name
 * - Content-Length: Size of the stream in bytes (optional but recommended)
 * 
 * Body: Raw stream data (text/plain)
 * 
 * Returns: Success message or error response
 */
router.post("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const itemId = SafeFunctions.parseNumericHeader(req.headers["sa-item-id"], "sa-item-id");
    const teamId = SafeFunctions.parseNumericHeader(req.headers["sa-team-id"], "sa-team-id");
    const projectId = SafeFunctions.parseNumericHeader(req.headers["sa-project-id"], "sa-project-id");
    const folderId = SafeFunctions.parseNumericHeader(req.headers["sa-folder-id"], "sa-folder-id");
    const fileName = req.headers["sa-file-name"] as string;

    // Parse content length if provided
    const contentLengthHeader = req.headers["content-length"];
    const contentLength = contentLengthHeader ? SafeFunctions.parseNumericHeader(contentLengthHeader, "content-length") : undefined;

    // Additional validation (should not happen if middleware works correctly)
    if (!itemId || !teamId || !projectId || !folderId || !fileName) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invalid or missing required headers",
            timestamp: new Date().toISOString(),
        });
    }

    try {
        // Handle request stream errors
        req.on("error", (error: Error) => {
            console.error("Request stream error:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: "Internal Server Error",
                    message: "Error reading request stream",
                    timestamp: new Date().toISOString(),
                });
            }
        });

        // Save the stream to repository
        await repository.saveDataStream(teamId, projectId, folderId, itemId, fileName, req, contentLength ?? undefined);

        res.status(200).json({
            message: "Data stream saved successfully",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error processing data stream:", error);
        if (!res.headersSent) {
            return res.status(500).json({
                error: "Internal Server Error",
                message: "Failed to process data stream",
                timestamp: new Date().toISOString(),
            });
        }
    }
});

export default router;

