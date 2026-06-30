import { S3Repository } from "./s3Repository";
import { LocalRepository } from "./localRepository";
import { Config } from "../utils/config";
import { DataStoreType, SaItemManifest } from "../types";
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
     * Reads and parses an item manifest (items/{scope}/<name>.json).
     * @param itemsRelativePath - Path relative to the items root
     * @returns Parsed manifest, or null if it does not exist
     */
    public async readManifest(itemsRelativePath: string): Promise<SaItemManifest | null> {
        return this.repository?.readManifest(itemsRelativePath) ?? null;
    }

    /**
     * Reads an owner-curated access map for an item, keyed by project scope and
     * item name (access_maps/{teamId}/{projectId}/<item_name>.json).
     * @param projectScope - "{teamId}/{projectId}"
     * @param itemName - validated, single-segment SuperAnnotate item name
     * @returns Parsed access map, or null if it does not exist
     */
    public async readAccessMap(projectScope: string, itemName: string): Promise<SaItemManifest | null> {
        return this.repository?.readAccessMap(projectScope, itemName) ?? null;
    }

    /**
     * Checks if a raw asset exists under the files root.
     */
    public async filesExists(filesRelativePath: string): Promise<boolean> {
        return this.repository?.filesExists(filesRelativePath) ?? false;
    }

    /**
     * Streams a raw asset from under the files root.
     */
    public async getFilesStream(filesRelativePath: string): Promise<NodeJS.ReadableStream | null> {
        return this.repository?.getFilesStream(filesRelativePath) ?? null;
    }

    /**
     * Mints a signed capability URL for a raw asset under the files root.
     */
    public getFilesSignedUrl(filesRelativePath: string, host: string): string {
        return this.repository?.getFilesSignedUrl(filesRelativePath, host) ?? "";
    }

    /**
     * Verifies a signed capability for a raw asset under the files root.
     */
    public async validateFilesSignature(filesRelativePath: string, expires: string, signature: string): Promise<boolean> {
        return this.repository?.validateFilesSignature(filesRelativePath, expires, signature) ?? false;
    }

    /**
     * Verifies the storage backend is reachable and accessible
     * @throws Error if the storage backend is not reachable or repository is not initialized
     */
    public async checkConnection(): Promise<void> {
        if (!this.repository) {
            throw new Error("Repository is not initialized");
        }
        await this.repository.checkConnection();
    }
}

// Export singleton instance
export default new Repository();