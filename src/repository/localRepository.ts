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
     * Constructs the full file path for an item
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param extension - File extension (e.g., "txt", "json")
     * @returns Full file path
     */
    private getFilePath(teamId: number, projectId: number, folderId: number, itemId: number, fileName: string): string {
        return path.join(this.basePath, "items", String(teamId), String(projectId), String(folderId), String(itemId), fileName);
    }

    /**
     * Constructs the directory path for a folder
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Directory path
     */
    private getFolderPath(teamId: number, projectId: number, folderId: number): string {
        return path.join(this.basePath, "items", String(teamId), String(projectId), String(folderId));
    }

    /**
     * Ensures a directory exists, creating it if necessary
     * @param dirPath - Directory path to create
     */
    private async ensureDirectory(dirPath: string): Promise<void> {
        await fs.mkdir(dirPath, { recursive: true });
    }

    /**
     * Deletes data associated with a specific item
     * Deletes the metadata JSON file for the item
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @throws Error if deletion fails
     */
    public async deleteData(teamId: number, projectId: number, folderId: number, itemId: number): Promise<void> {
        const filePath = this.getFilePath(teamId, projectId, folderId, itemId, "json");
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
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param fileName - File name
     * @returns Readable stream of the data, or null if file doesn't exist
     */
    public async getDataStream(teamId: number, projectId: number, folderId: number, itemId: number, fileName: string): Promise<NodeJS.ReadableStream | null> {
        const filePath = this.getFilePath(teamId, projectId, folderId, itemId, fileName);

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
     * Saves a data stream for a specific item
     * Writes the stream to filesystem as a .txt file
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param stream - Readable stream containing the data to save
     * @param contentLength - Optional content length in bytes (not used for local filesystem)
     * @throws Error if upload fails
     */
    public async saveDataStream(teamId: number, projectId: number, folderId: number, itemId: number, fileName: string, stream: Readable, contentLength?: number): Promise<void> {
        const filePath = this.getFilePath(teamId, projectId, folderId, itemId, fileName);
        const dirPath = path.dirname(filePath);

        // Ensure directory exists
        await this.ensureDirectory(dirPath);

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

    public async getSignedUrl(teamId: number, projectId: number, folderId: number, itemId: number, fileName: string): Promise<string> {
        const filePath = path.join("items", String(teamId), String(projectId), String(folderId), String(itemId), fileName);
        const expires = Date.now() + Config.signUrlExpirationTimeHr() * 60 * 60 * 1000;
        const dataToSign = `${filePath}-${expires}`;
        const signature = crypto.createHmac('sha256', Config.localSignSecretKey())
            .update(dataToSign)
            .digest('hex');

        // Construct the full URL for the client
        // The client will use this URL to request the file
        return `/file/${fileName}?path=${encodeURIComponent(filePath)}&expires=${expires}&signature=${signature}`;

    }
}
