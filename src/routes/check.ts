import { Router, Request, Response } from "express";
import repository from "../repository";
import * as SaApi from "../utils/saApi";

const router = Router();

/**
 * GET /check
 * Verifies that the service can authenticate against SuperAnnotate (via /api/v1/me)
 * and reach the configured storage backend
 *
 * Headers:
 * - sa-authorization: SuperAnnotate access token (required)
 *
 * Returns:
 * - 200 OK with { auth: "ok", storage: "ok" } when both dependencies are healthy
 * - 401 Unauthorized when the SuperAnnotate token is missing or invalid
 * - 503 Service Unavailable when the storage backend is unreachable
 */
router.get("/", async (req: Request, res: Response) => {
    const saAccessToken = req.headers["sa-authorization"] as string;

    if (!saAccessToken) {
        return res.status(401).json({
            error: "Unauthorized",
            message: "API key or authorization token is required",
            timestamp: new Date().toISOString(),
        });
    }

    // Check SuperAnnotate auth via /api/v1/me
    try {
        await SaApi.saApi.getMe(saAccessToken);
    } catch (error) {
        console.error("Auth check failed:", error);
        const authError = error as SaApi.SaAuthError;
        const status = authError?.error?.name === "AuthException" ? 401 : 502;

        return res.status(status).json({
            auth: "error",
            storage: "unknown",
            message: status === 401
                ? "You are not authorized to access this resource"
                : "Failed to reach SuperAnnotate API",
            timestamp: new Date().toISOString(),
        });
    }

    // Check storage backend connectivity
    try {
        await repository.checkConnection();
    } catch (error) {
        console.error("Storage connection check failed:", error);
        return res.status(503).json({
            auth: "ok",
            storage: "error",
            message: error instanceof Error ? error.message : "Storage backend is not reachable",
            timestamp: new Date().toISOString(),
        });
    }

    return res.status(200).json({
        auth: "ok",
        storage: "ok",
        timestamp: new Date().toISOString(),
    });
});

export default router;
