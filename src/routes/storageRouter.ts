import { Router, Request, Response } from "express";
import { lookup } from "mime-types";
import { AuthSaMiddleware } from "../middleware/authSaMiddleware";
import { PathValidatorMiddleware } from "../middleware/pathValidatorMiddleware";
import { SaInternalRequest } from "../types";
import { AppError } from "../types/errors";
import { sendError } from "../utils/errorHandler";
import { isSafeRelativeSubpath } from "../utils/pathSafety";
import { Config } from "../utils/config";
import repository from "../repository";

const router = Router();

/**
 * MIME types that are safe to render inline in a browser: static, non-active
 * content (raster images, audio/video, PDF). Everything else — including
 * image/svg+xml, text/html, XML, and unknown types — is forced to download so
 * it cannot execute as a same-origin document. Programmatic SDK clients read the
 * body regardless of disposition, so both consumption flows keep working.
 */
const INLINE_SAFE_TYPES = new Set<string>([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "application/pdf",
]);

/**
 * GET /storage/
 * Resolves the SuperAnnotate item (via PathValidatorMiddleware), reads its
 * owner-curated access map (access_maps/{teamId}/{projectId}/<name>.json), and
 * returns signed capability URLs for each declared raw asset. The map's `files`
 * array is the allowlist: only files it declares can ever be signed.
 *
 * @returns 200 { label, files: { <fileName>: signedUrl }, metadata } or error
 */
router.get("/", AuthSaMiddleware, PathValidatorMiddleware, async (req: Request, res: Response) => {
    const { saScope, saItemName } = req as SaInternalRequest;
    // Access maps are project-scoped (team/project), independent of the item's
    // folder, so they can be authored before the folder is known.
    const projectScope = saScope.split("/").slice(0, 2).join("/");

    try {
        const manifest = await repository.readAccessMap(projectScope, saItemName);
        if (!manifest) {
            sendError(res, 404, "Item access map not found", "NOT_FOUND_MANIFEST");
            return;
        }

        const host = Config.publicBaseUrl();
        const files: Record<string, string> = {};
        for (const entry of manifest.files) {
            // Each manifest entry is a relative path under the files root; it may
            // be nested (e.g. "images/image_1.jpg"). The files jail is enforced
            // on resolve; this rejects traversal/absolute/control-char entries.
            if (!isSafeRelativeSubpath(entry)) {
                console.debug(
                    `[storage] Invalid manifest entry for ${saScope}/${saItemName}: ${JSON.stringify(entry)}`
                );
                sendError(res, 500, "Invalid manifest entry", "INTERNAL_ERROR");
                return;
            }
            files[entry] = repository.getFilesSignedUrl(entry, host);
        }

        return res.status(200).json({
            label: manifest.label,
            files,
            metadata: manifest.metadata,
        });
    } catch (error) {
        if (error instanceof AppError) {
            sendError(res, error.statusCode, error.message, error.code);
            return;
        }
        sendError(res, 500, "Failed to read item manifest");
    }
});

/**
 * GET /storage/fileSigned
 * Redeems a signed capability and streams a raw asset from the files root.
 * Stateless: verified by HMAC + expiry only, no SuperAnnotate or DB lookup.
 *
 * @returns File stream or standardized error response
 */
router.get("/fileSigned", async (req: Request, res: Response) => {
    const { path, expires, signature } = req.query as { path?: string; expires?: string; signature?: string };
    if (!path || !expires || !signature) {
        sendError(res, 400, "Missing required query parameters", "MISSING_QUERY_PARAMETERS");
        return;
    }

    const isValidSignature = await repository.validateFilesSignature(path, expires, signature);
    if (!isValidSignature) {
        sendError(res, 401, "Invalid signature", "INVALID_SIGNATURE");
        return;
    }

    try {
        const stream = await repository.getFilesStream(path);
        if (!stream) {
            sendError(res, 404, "File does not exist", "NOT_FOUND_FILE");
            return;
        }

        // Never let the browser MIME-sniff: the declared type is authoritative.
        res.setHeader("X-Content-Type-Options", "nosniff");

        const detectedType = lookup(path) || "application/octet-stream";
        if (INLINE_SAFE_TYPES.has(detectedType)) {
            // Static, non-active content: safe to preview inline.
            res.setHeader("Content-Type", detectedType);
            res.setHeader("Content-Disposition", "inline");
        } else {
            // Active or unknown types (e.g. SVG/HTML): force download so they
            // cannot execute as a same-origin document.
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", "attachment");
        }

        stream.on("error", () => {
            if (!res.headersSent) sendError(res, 500, "Failed to send file");
        });
        stream.pipe(res);
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

export default router;
