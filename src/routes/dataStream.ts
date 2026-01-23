import { Router, Request, Response } from "express";
import { saItemMiddleware } from "../middleware/auth";
import repository from "../repository";

const router = Router();

// Apply authorization middleware to all routes
// This ensures all requests are authenticated and validated
router.use(saItemMiddleware);

/**
 * Helper function to parse and validate numeric header values
 * @param headerValue - Header value as string
 * @param headerName - Name of the header for error messages
 * @returns Parsed number or null if invalid
 */
function parseNumericHeader(headerValue: string | string[] | undefined, headerName: string): number | null {
    if (!headerValue) {
        return null;
    }
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const parsed = Number(value);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * GET /dataStream
 * Retrieves a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - sa-item-id: Item ID
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * 
 * Returns: Stream of data (text/plain) or error response
 */
router.get("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const itemId = parseNumericHeader(req.headers["sa-item-id"], "sa-item-id");
    const teamId = parseNumericHeader(req.headers["sa-team-id"], "sa-team-id");
    const projectId = parseNumericHeader(req.headers["sa-project-id"], "sa-project-id");
    const folderId = parseNumericHeader(req.headers["sa-folder-id"], "sa-folder-id");

    // Additional validation (should not happen if middleware works correctly)
    if (!itemId || !teamId || !projectId || !folderId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Invalid or missing required headers",
            timestamp: new Date().toISOString(),
        });
    }

    try {
        const stream = await repository.getDataStream(teamId, projectId, folderId, itemId);

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
 * - Content-Length: Size of the stream in bytes (optional but recommended)
 * 
 * Body: Raw stream data (text/plain)
 * 
 * Returns: Success message or error response
 */
router.post("/", async (req: Request, res: Response) => {
    // Parse headers (already validated by middleware, but ensure they're numbers)
    const itemId = parseNumericHeader(req.headers["sa-item-id"], "sa-item-id");
    const teamId = parseNumericHeader(req.headers["sa-team-id"], "sa-team-id");
    const projectId = parseNumericHeader(req.headers["sa-project-id"], "sa-project-id");
    const folderId = parseNumericHeader(req.headers["sa-folder-id"], "sa-folder-id");
    
    // Parse content length if provided
    const contentLengthHeader = req.headers["content-length"];
    const contentLength = contentLengthHeader ? parseNumericHeader(contentLengthHeader, "content-length") : undefined;

    // Additional validation (should not happen if middleware works correctly)
    if (!itemId || !teamId || !projectId || !folderId) {
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
        await repository.saveDataStream(teamId, projectId, folderId, itemId, req, contentLength ?? undefined);

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

