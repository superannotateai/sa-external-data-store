import { Config } from "../utils/config";
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
        return path.join(this.basePath, "items", relativePath);
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
        console.log(path);
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
    public async saveDataStream(path: string, stream: Readable): Promise<void> {
        const filePath = this.getFilePath(path);

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
        const expires = Date.now() + Config.signUrlExpirationTimeHr() * 60 * 60 * 1000;
        const dataToSign = `${path}-${expires}`;
        const signature = crypto.createHmac('sha256', Config.localSignSecretKey())
            .update(dataToSign)
            .digest('hex');

        // Construct the full URL for the client
        // The client will use this URL to request the file
        return `${host}/storage/fileSigned?path=${encodeURIComponent(path)}&expires=${expires}&signature=${signature}`;
    }

    public async validateSignature(path: string, expires: string, signature: string): Promise<boolean> {
        const expiresTimestamp = Number(expires);
        if (!Number.isFinite(expiresTimestamp) || expiresTimestamp < Date.now()) {
            return false;
        }

        const dataToSign = `${path}-${expires}`;
        const expectedSignature = crypto
            .createHmac("sha256", Config.localSignSecretKey())
            .update(dataToSign)
            .digest("hex");

        return expectedSignature === signature;
    }
}
