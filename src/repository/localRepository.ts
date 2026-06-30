import { Config } from "../utils/config";
import { assertSafeRelativeItemsPath, isSafeSegment, resolveAccessMapsPath, resolveFilesPath, resolveItemsFilePath } from "../utils/pathSafety";
import { AppError } from "../types/errors";
import { SaItemManifest } from "../types";
import { Readable } from "stream";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import crypto from "crypto";

/**
 * Local filesystem repository implementation
 * Handles data storage operations using the local filesystem
 * 
 * Data is stored with the following structure:
 * - Data streams: {basePath}/items/{teamId}/{projectId}/{folderId}/{itemId}.txt
 * - Metadata: {basePath}/items/{teamId}/{projectId}/{folderId}/{itemId}.json
 */
export class LocalRepository {
    private basePath: string;

    /**
     * Creates a new LocalRepository instance
     * Initializes the base path from configuration
     */
    constructor() {
        this.basePath = Config.localStoragePath();
    }

    /**
     * Constructs the directory path for a folder (items/teamId/projectId/folderId)
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Directory path under basePath
     */
    private getFolderPath(teamId: number, projectId: number, folderId: number): string {
        return path.join(this.basePath, "items", String(teamId), String(projectId), String(folderId));
    }

    /**
     * Constructs the full file path for an item
     * @param relativePath - Relative path to the file
     * @returns Full file path
     */
    public getFilePath(relativePath: string): string {
        return assertSafeRelativeItemsPath(relativePath, this.basePath);
    }

    /**
     * Checks if a file exists in the storage
     * @param path - Relative path to the file
     * @returns true if file exists, false if not
     */
    public async isFileExists(path: string): Promise<boolean> {
        const filePath = this.getFilePath(path);
        return fs.access(filePath).then(() => true).catch(() => false);
    }

    /**
     * Deletes the file at the given path
     * @param path - Relative path to the file
     * @throws Error if deletion fails
     */
    public async deleteData(path: string): Promise<void> {
        const filePath = this.getFilePath(path);
        await fs.unlink(filePath);
    }

    /**
     * Lists all data keys for a specific folder
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Array of file paths in the folder
     */
    public async listData(teamId: number, projectId: number, folderId: number): Promise<string[]> {
        const folderPath = this.getFolderPath(teamId, projectId, folderId);

        try {
            const files = await fs.readdir(folderPath);
            // Return full relative paths matching S3 format
            return files.map(file => `items/${teamId}/${projectId}/${folderId}/${file}`);
        } catch (error: any) {
            // If directory doesn't exist, return empty array
            if (error.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    }

    /**
     * Retrieves a data stream for a specific item
     * Reads the file from filesystem and returns it as a readable stream
     * @param path - File path
     * @returns Readable stream of the data, or null if file doesn't exist
     */
    public async getDataStream(path: string): Promise<NodeJS.ReadableStream | null> {
        const filePath = this.getFilePath(path);
        try {
            // Check if file exists before creating stream
            await fs.access(filePath);
            return fsSync.createReadStream(filePath);
        } catch (error: any) {
            // If file doesn't exist, return null
            if (error.code === "ENOENT") {
                return null;
            }
            throw error;
        }
    }

    /**
     * Saves a data stream to the given path
     * @param path - Relative path to the file
     * @param stream - Readable stream containing the data to save
     * @throws Error if write fails
     */
    public async saveDataStream(relativePath: string, stream: Readable): Promise<void> {
        const filePath = this.getFilePath(relativePath);

        // Ensure parent directory exists before writing
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Create write stream and pipe the input stream to it
        const writeStream = fsSync.createWriteStream(filePath);

        return new Promise((resolve, reject) => {
            stream.pipe(writeStream);

            writeStream.on("finish", () => {
                resolve();
            });

            writeStream.on("error", (error: Error) => {
                reject(error);
            });

            stream.on("error", (error: Error) => {
                reject(error);
            });
        });
    }

    public async getSignedUrl(path: string, host?: string): Promise<string> {
        if (!host) {
            throw new Error("Host is required");
        }
        assertSafeRelativeItemsPath(path, this.basePath);
        const expires = Date.now() + Config.signUrlExpirationTimeHr() * 60 * 60 * 1000;
        const dataToSign = `${path}-${expires}`;
        const signature = crypto.createHmac('sha256', Config.localSignSecretKey())
            .update(dataToSign)
            .digest('hex');

        // Construct the full URL for the client
        // The client will use this URL to request the file
        return `${host}/storage/fileSigned?path=${encodeURIComponent(path)}&expires=${expires}&signature=${signature}`;
    }

    /**
     * Verifies the local storage base directory exists and is readable/writable
     * @throws Error if the directory cannot be accessed
     */
    public async checkConnection(): Promise<void> {
        await fs.access(this.basePath, fsSync.constants.R_OK | fsSync.constants.W_OK);
    }

    public async validateSignature(path: string, expires: string, signature: string): Promise<boolean> {
        if (!resolveItemsFilePath(path, this.basePath)) {
            return false;
        }

        const expiresTimestamp = Number(expires);
        if (!Number.isFinite(expiresTimestamp) || expiresTimestamp < Date.now()) {
            return false;
        }

        const dataToSign = `${path}-${expires}`;
        const expectedSignature = crypto
            .createHmac("sha256", Config.localSignSecretKey())
            .update(dataToSign)
            .digest("hex");

        return LocalRepository.signaturesMatch(expectedSignature, signature);
    }

    private static signaturesMatch(expectedSignature: string, signature: string): boolean {
        if (expectedSignature.length !== signature.length) {
            return false;
        }
        try {
            return crypto.timingSafeEqual(
                Buffer.from(expectedSignature, "hex"),
                Buffer.from(signature, "hex")
            );
        } catch {
            return false;
        }
    }

    /**
     * Reads and parses an item manifest (items/{scope}/<name>.json).
     * @param itemsRelativePath - Path relative to the items root
     * @returns Parsed manifest, or null if the manifest file does not exist
     * @throws AppError(500) if the manifest exists but cannot be parsed
     */
    public async readManifest(itemsRelativePath: string): Promise<SaItemManifest | null> {
        const filePath = this.getFilePath(itemsRelativePath);
        let raw: string;
        try {
            raw = await fs.readFile(filePath, "utf8");
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return null;
            }
            throw error;
        }

        try {
            const parsed = JSON.parse(raw) as SaItemManifest;
            if (!parsed || !Array.isArray(parsed.files)) {
                throw new AppError("Malformed manifest", 500, "INTERNAL_ERROR");
            }
            return parsed;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Malformed manifest", 500, "INTERNAL_ERROR");
        }
    }

    /**
     * Reads an owner-curated access map for an item, keyed by project scope and
     * item name: access_maps/{teamId}/{projectId}/<item_name>.json.
     *
     * Decouples the item's signable `files` allowlist from the folder-scoped
     * storage path, so the map can exist before the item's folder is known.
     * @param projectScope - "{teamId}/{projectId}" (numeric, validated upstream)
     * @param itemName - validated, single-segment SuperAnnotate item name
     * @returns Parsed access map, or null if it does not exist
     * @throws AppError(400) if the item name is unsafe or the path escapes the root
     * @throws AppError(500) if the map exists but cannot be parsed
     */
    public async readAccessMap(projectScope: string, itemName: string): Promise<SaItemManifest | null> {
        if (!isSafeSegment(itemName)) {
            throw new AppError("Invalid item name", 400, "VALIDATION_INVALID_PATH");
        }
        const filePath = resolveAccessMapsPath(`${projectScope}/${itemName}.json`, this.basePath);
        if (!filePath) {
            throw new AppError("Invalid access map path", 400, "VALIDATION_INVALID_PATH");
        }

        let raw: string;
        try {
            raw = await fs.readFile(filePath, "utf8");
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return null;
            }
            throw error;
        }

        try {
            const parsed = JSON.parse(raw) as SaItemManifest;
            if (!parsed || !Array.isArray(parsed.files)) {
                throw new AppError("Malformed access map", 500, "INTERNAL_ERROR");
            }
            return parsed;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Malformed access map", 500, "INTERNAL_ERROR");
        }
    }

    /**
     * Resolves a path under the files root, throwing if it escapes the jail.
     */
    private getFilesFilePath(filesRelativePath: string): string {
        const resolved = resolveFilesPath(filesRelativePath, this.basePath);
        if (!resolved) {
            throw new AppError("Invalid file path", 400, "VALIDATION_INVALID_PATH");
        }
        return resolved;
    }

    /**
     * Checks if a raw asset exists under the files root.
     */
    public async filesExists(filesRelativePath: string): Promise<boolean> {
        const filePath = this.getFilesFilePath(filesRelativePath);
        return fs.access(filePath).then(() => true).catch(() => false);
    }

    /**
     * Streams a raw asset from under the files root.
     */
    public async getFilesStream(filesRelativePath: string): Promise<NodeJS.ReadableStream | null> {
        const filePath = this.getFilesFilePath(filesRelativePath);
        try {
            await fs.access(filePath);
            return fsSync.createReadStream(filePath);
        } catch (error: any) {
            if (error.code === "ENOENT") {
                return null;
            }
            throw error;
        }
    }

    /**
     * Mints a signed capability URL for a raw asset under the files root.
     * The signed path is jailed to the files root on redemption.
     */
    public getFilesSignedUrl(filesRelativePath: string, host: string): string {
        if (!host) {
            throw new Error("Host is required");
        }
        // Validate the path is inside the files jail before signing.
        this.getFilesFilePath(filesRelativePath);

        const expires = Date.now() + Config.signUrlExpirationTimeHr() * 60 * 60 * 1000;
        const dataToSign = `${filesRelativePath}-${expires}`;
        const signature = crypto
            .createHmac("sha256", Config.localSignSecretKey())
            .update(dataToSign)
            .digest("hex");

        return `${host}/storage/fileSigned?path=${encodeURIComponent(filesRelativePath)}&expires=${expires}&signature=${signature}`;
    }

    /**
     * Verifies a signed capability for a raw asset under the files root.
     */
    public async validateFilesSignature(filesRelativePath: string, expires: string, signature: string): Promise<boolean> {
        if (!resolveFilesPath(filesRelativePath, this.basePath)) {
            return false;
        }

        const expiresTimestamp = Number(expires);
        if (!Number.isFinite(expiresTimestamp) || expiresTimestamp < Date.now()) {
            return false;
        }

        const dataToSign = `${filesRelativePath}-${expires}`;
        const expectedSignature = crypto
            .createHmac("sha256", Config.localSignSecretKey())
            .update(dataToSign)
            .digest("hex");

        return LocalRepository.signaturesMatch(expectedSignature, signature);
    }
}
