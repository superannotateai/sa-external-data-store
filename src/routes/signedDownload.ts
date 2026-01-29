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
        const signedUrl = await repository.getSignedUrl(teamId, projectId, folderId, itemId, fileName);
        if (signedUrl === "") {
            return res.status(404).json({
                error: "Not Found",
                message: "Signed URL not found",
                timestamp: new Date().toISOString(),
            });
        }
        return res.status(200).json({
            signedUrl: signedUrl,
            timestamp: new Date().toISOString(),
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

export default router;

