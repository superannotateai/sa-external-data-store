import { Router, Request, Response } from "express";
import fs from "fs";
import { localSignValidator } from "../middleware/localSignValidator";
import { Config } from "../utils/config";
import path from "path";

const router = Router();

// Apply authorization middleware to all routes
// This ensures all requests are authenticated and validated
router.use(localSignValidator);

/**
 * GET /{fileName}
 * Retrieves a data stream for a specific item
 * 
 * Headers (validated by middleware):
 * - path: File path
 * - expires: Expiration time
 * - signature: Signature
 * 
 * Returns: Stream of data (text/plain) or error response
 */
router.get("/:fileName", async (req: Request, res: Response) => {
    const fileName = req.params.fileName;
    const filePath = (req as any).filePath;

    try {
        // Serve the file at filePath
        if (!filePath) {
            return res.status(400).json({
                error: "Bad Request",
                message: "File path missing or unauthorized",
                timestamp: new Date().toISOString(),
            });
        }
        const absoluteFilePath = path.join(Config.localStoragePath(), filePath);
        console.log(filePath);
        if (!fs.existsSync(absoluteFilePath)) {
            return res.status(404).json({
                error: "Not Found",
                message: "File does not exist",
                timestamp: new Date().toISOString(),
            });
        }
        return res.sendFile(absoluteFilePath, (err: any) => {
            if (err) {
                console.error("Error sending file:", err);
                if (!res.headersSent) {
                    return res.status(500).json({
                        error: "Internal Server Error",
                        message: "Failed to send file",
                        timestamp: new Date().toISOString(),
                    });
                }
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

export default router;

