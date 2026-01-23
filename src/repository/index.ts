import { S3Repository } from "./s3Repository";
import { LocalRepository } from "./localRepository";
import { Config } from "../utils/config";
import { Readable } from "stream";

/**
 * Repository class providing a unified interface for data storage operations
 * Supports multiple storage backends: S3 and Local filesystem
 * 
 * This class implements the Repository pattern to abstract storage implementation details
 */
class Repository {
    private repository: S3Repository | LocalRepository | null = null;

    /**
     * Creates a new Repository instance
     * Initializes the appropriate storage backend based on configuration
     * @throws Error if data store configuration is invalid
     */
    constructor() {
        const dataStore = Config.dataStore();
        
        if (dataStore === "S3") {
            this.repository = new S3Repository();
        } else if (dataStore === "LOCAL") {
            this.repository = new LocalRepository();
        } else {
            throw new Error(`Invalid data store: ${dataStore}. Valid options are: S3, LOCAL`);
        }
    }

    /**
     * Deletes data associated with a specific item
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @throws Error if deletion fails
     */
    public async deleteData(teamId: number, projectId: number, folderId: number, itemId: number): Promise<void> {
        await this.repository?.deleteData(teamId, projectId, folderId, itemId);
    }

    /**
     * Lists all data keys for a specific folder
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Array of data keys (file paths), empty array if none found
     */
    public async listData(teamId: number, projectId: number, folderId: number): Promise<string[]> {
        return this.repository?.listData(teamId, projectId, folderId) ?? [];
    }

    /**
     * Retrieves a data stream for a specific item
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @returns Readable stream of the data, or null if not found
     */
    public async getDataStream(teamId: number, projectId: number, folderId: number, itemId: number): Promise<NodeJS.ReadableStream | null> {
        return this.repository?.getDataStream(teamId, projectId, folderId, itemId) ?? null;
    }

    /**
     * Saves a data stream for a specific item
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param stream - Readable stream containing the data to save
     * @param contentLength - Optional content length in bytes (helps with large file uploads)
     * @throws Error if save operation fails
     */
    public async saveDataStream(teamId: number, projectId: number, folderId: number, itemId: number, stream: Readable, contentLength?: number): Promise<void> {
        await this.repository?.saveDataStream(teamId, projectId, folderId, itemId, stream, contentLength);
    }
}

// Export singleton instance
export default new Repository();