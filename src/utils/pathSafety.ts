import path from "path";
import { AppError } from "../types/errors";

/**
 * Resolves a relative path under {basePath}/{rootDir} and returns the absolute file path.
 * Returns null if the path escapes the root or is otherwise unsafe.
 */
function resolveUnderRoot(relativePath: string, basePath: string, rootDir: string): string | null {
    if (!relativePath || typeof relativePath !== "string") {
        return null;
    }
    if (relativePath.includes("\0")) {
        return null;
    }
    if (path.isAbsolute(relativePath)) {
        return null;
    }

    const root = path.resolve(basePath, rootDir);
    const resolved = path.resolve(root, relativePath);

    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        return null;
    }

    return resolved;
}

/**
 * Resolves a relative path under {basePath}/items.
 * Returns null if the path escapes the items root or is otherwise unsafe.
 */
export function resolveItemsFilePath(relativePath: string, basePath: string): string | null {
    return resolveUnderRoot(relativePath, basePath, "items");
}

/**
 * Resolves a relative path under {basePath}/files (raw assets root).
 * Returns null if the path escapes the files root or is otherwise unsafe.
 */
export function resolveFilesPath(relativePath: string, basePath: string): string | null {
    return resolveUnderRoot(relativePath, basePath, "files");
}

/**
 * Resolves a relative path under {basePath}/access_maps (owner-curated item
 * access maps, keyed by {teamId}/{projectId}/<item_name>.json).
 * Returns null if the path escapes the access_maps root or is otherwise unsafe.
 */
export function resolveAccessMapsPath(relativePath: string, basePath: string): string | null {
    return resolveUnderRoot(relativePath, basePath, "access_maps");
}

/**
 * Validates that a relative path stays within {basePath}/items.
 * @throws AppError with 400 when the path is unsafe
 */
export function assertSafeRelativeItemsPath(relativePath: string, basePath: string): string {
    const resolved = resolveItemsFilePath(relativePath, basePath);
    if (!resolved) {
        throw new AppError("Invalid file path", 400, "VALIDATION_INVALID_PATH");
    }
    return resolved;
}

/**
 * Rejects relative paths that must not be used as storage keys (S3 or local).
 */
export function isUnsafeRelativePath(relativePath: string): boolean {
    if (!relativePath || typeof relativePath !== "string") {
        return true;
    }
    if (relativePath.includes("\0")) {
        return true;
    }
    if (path.isAbsolute(relativePath)) {
        return true;
    }
    return relativePath.split(/[/\\]/).some((segment) => segment === "..");
}

/**
 * Validates that a value is a single, filesystem-safe path segment.
 * Used for values derived from SuperAnnotate (item names) and manifest file
 * entries before they are used to build a path. Immutable does not mean safe:
 * names can still contain separators, dot segments, NUL bytes, or be too long.
 */
export function isSafeSegment(segment: unknown): segment is string {
    if (!segment || typeof segment !== "string") {
        return false;
    }
    // Reject control characters (incl. NUL and CR/LF). Beyond filesystem safety,
    // these can corrupt or inject HTTP response headers if the value is ever
    // reflected (e.g. into Content-Disposition).
    if (/[\u0000-\u001f\u007f]/.test(segment)) {
        return false;
    }
    if (segment === "." || segment === "..") {
        return false;
    }
    if (/[/\\]/.test(segment)) {
        return false;
    }
    // Reasonable upper bound to avoid filesystem limits / abuse.
    if (segment.length > 255) {
        return false;
    }
    return true;
}

/**
 * Validates a relative sub-path made of one or more safe segments
 * (e.g. "image.png" or "images/image_1.jpg"). Allows nested directories but
 * rejects absolute paths, "."/".." segments, empty segments, separators that
 * would produce them, and control characters. The actual jail is still enforced
 * by the resolve* helpers; this is the cheap structural pre-check.
 */
export function isSafeRelativeSubpath(relativePath: unknown): relativePath is string {
    if (!relativePath || typeof relativePath !== "string") {
        return false;
    }
    if (path.isAbsolute(relativePath)) {
        return false;
    }
    const segments = relativePath.split(/[/\\]/);
    return segments.length > 0 && segments.every((segment) => isSafeSegment(segment));
}
