import { Request, Response, NextFunction } from "express";
import * as SaApi from "../utils/saApi";

/**
 * Middleware to authenticate and authorize requests using SuperAnnotate API
 * 
 * Validates:
 * - Authorization token presence
 * - Required SuperAnnotate entity IDs (team, project, folder, item)
 * - Item existence and user access permissions via SuperAnnotate API
 * 
 * Required headers:
 * - sa-authorization: SuperAnnotate access token
 * - sa-team-id: Team ID
 * - sa-project-id: Project ID
 * - sa-folder-id: Folder ID
 * - sa-item-id: Item ID
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response with error status if validation fails, otherwise calls next()
 */
export const saItemMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    // Extract required headers
    const saAccessToken = req.headers["sa-authorization"] as string;
    const itemId = req.headers["sa-item-id"] as string;
    const teamId = req.headers["sa-team-id"] as string;
    const projectId = req.headers["sa-project-id"] as string;
    const folderId = req.headers["sa-folder-id"] as string;

    // Validate authorization token
    if (!saAccessToken) {
        return res.status(401).json({
            error: "Unauthorized",
            message: "API key or authorization token is required",
            timestamp: new Date().toISOString(),
        });
    }

    // Validate required entity IDs
    if (!teamId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Team ID is required",
            timestamp: new Date().toISOString(),
        });
    }

    if (!projectId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Project ID is required",
            timestamp: new Date().toISOString(),
        });
    }

    if (!folderId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Folder ID is required",
            timestamp: new Date().toISOString(),
        });
    }

    if (!itemId) {
        return res.status(400).json({
            error: "Bad Request",
            message: "Item ID is required",
            timestamp: new Date().toISOString(),
        });
    }

    // Validate and authorize via SuperAnnotate API
    try {
        const teamIdNum = Number(teamId);
        const projectIdNum = Number(projectId);
        const folderIdNum = Number(folderId);

        // Validate that IDs are valid numbers
        if (isNaN(teamIdNum) || isNaN(projectIdNum) || isNaN(folderIdNum)) {
            return res.status(400).json({
                error: "Bad Request",
                message: "Team ID, Project ID, and Folder ID must be valid numbers",
                timestamp: new Date().toISOString(),
            });
        }

        // Verify item exists and user has access
        const item = await SaApi.saApi.getItem(teamIdNum, projectIdNum, folderIdNum, itemId, saAccessToken);
        
        if (!item) {
            return res.status(404).json({
                error: "Not Found",
                message: "Item not found",
                timestamp: new Date().toISOString(),
            });
        }

        // All validations passed, proceed to route handler
        next();
    } catch (error) {
        console.error("Error getting item:", error);
        const authError = error as SaApi.SaAuthError;
        
        // Handle authentication errors specifically
        if (authError?.error?.name === "AuthException") {
            return res.status(401).json({
                error: "Unauthorized",
                message: "You are not authorized to access this resource",
                timestamp: new Date().toISOString(),
            });
        }
        
        // Handle other errors
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to validate item access",
            timestamp: new Date().toISOString(),
        });
    }
};