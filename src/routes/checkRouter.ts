import { Router, Request, Response } from "express";
import repository from "../repository";
import { AuthSaMiddleware } from "../middleware/authSaMiddleware";
import { sendError } from "../utils/errorHandler";
import { ErrorCode } from "../types";

const router = Router();

/**
 * GET /check
 * Verifies that the service can authenticate against SuperAnnotate (via AuthSaMiddleware)
 * and reach the configured storage backend
 *
 * Headers:
 * - header named by Config.saAuthHeader(): SuperAnnotate access token (required)
 *
 * Returns:
 * - 200 OK with { auth: "ok", storage: "ok" } when both dependencies are healthy
 * - 401 Unauthorized when the SuperAnnotate token is missing or invalid (from AuthSaMiddleware)
 * - 500 Internal Server Error when the storage backend is unreachable
 */
router.get("/", AuthSaMiddleware, async (_req: Request, res: Response) => {
    try {
        await repository.checkConnection();
    } catch (error) {
        console.error("Storage connection check failed:", error);
        sendError(res, 500, "Failed to validate storage connection", ErrorCode.INTERNAL_SERVER_ERROR);
        return;
    }

    res.status(200).json({
        auth: "ok",
        storage: "ok",
        timestamp: new Date().toISOString(),
    });
});

export default router;
