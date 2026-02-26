import { S3Repository } from "./s3Repository";
import { LocalRepository } from "./localRepository";
import { Config } from "../utils/config";
import { DataStoreType } from "../types";
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
        const dataStore: DataStoreType = Config.dataStore();

        if (dataStore === "S3") {
            this.repository = new S3Repository();
        } else {
            this.repository = new LocalRepository();
        }
    }

    /**
     * Retrieves a data stream for a path
     * @param path - Relative path to the file
     * @returns Readable stream of the data, or null if not found
     */
    public async getDataStream(path: string): Promise<NodeJS.ReadableStream | null> {
        return this.repository?.getDataStream(path) ?? null;
    }

    /**
     * Saves a data stream for a specific item
     * @param path - Relative path to the file
     * @param stream - Readable stream containing the data to save
     * @throws Error if save operation fails
     */
    public async saveDataStream(path: string, stream: Readable): Promise<void> {
        await this.repository?.saveDataStream(path, stream);
    }

    /**
     * Retrieves a signed URL for a path
     * @param path - Relative path to the file
     * @returns Signed URL string
     */
    public async getSignedUrl(path: string, host?: string): Promise<string> {
        return this.repository?.getSignedUrl(path, host) ?? "";
    }

    /**
     * Retrieves the full file path for a specific item
     * @param path - Relative path to the file
     * @returns Full file path
     */
    public getFilePath(path: string): string {
        return this.repository?.getFilePath(path) ?? "";
    }

    /**
     * Checks if a file exists in the storage
     * @param path - Relative path to the file
     * @returns true if file exists, false if not
     */
    public async isFileExists(path: string): Promise<boolean> {
        return this.repository?.isFileExists(path) ?? false;
    }

    /**
     * Validates signed URL parameters for storage backends that support local HMAC signatures
     * @param path - Relative path to the file
     * @param expires - Expiration timestamp in milliseconds
     * @param signature - HMAC signature
     * @returns true if signature is valid, false otherwise
     */
    public async validateSignature(path: string, expires: string, signature: string): Promise<boolean> {
        return this.repository?.validateSignature(path, expires, signature) ?? false;
    }
}

// Export singleton instance
export default new Repository();