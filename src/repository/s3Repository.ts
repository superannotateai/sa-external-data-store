import { S3Sdk } from "../utils/s3Sdk";
import { Readable } from "stream";

/**
 * S3-specific repository implementation
 * Handles data storage operations using AWS S3
 * 
 * Data is stored with the following structure:
 * - Data streams: items/{teamId}/{projectId}/{folderId}/{itemId}.txt
 * - Metadata: items/{teamId}/{projectId}/{folderId}/{itemId}.json
 */
export class S3Repository {
    private s3Sdk: S3Sdk;

    /**
     * Creates a new S3Repository instance
     * Initializes the S3 SDK client
     */
    constructor() {
        this.s3Sdk = new S3Sdk();
    }

    /**
     * Checks connectivity to the underlying S3 bucket
     * @throws Error if the bucket is not reachable or credentials are invalid
     */
    public async checkConnection(): Promise<void> {
        await this.s3Sdk.headBucket();
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
        await this.s3Sdk.deleteFile(`items/${teamId}/${projectId}/${folderId}/${itemId}.json`);
    }

    /**
     * Lists all data keys for a specific folder
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Array of S3 object keys (file paths) in the folder
     */
    public async listData(teamId: number, projectId: number, folderId: number): Promise<string[]> {
        return await this.s3Sdk.listObjects(`items/${teamId}/${projectId}/${folderId}`);
    }

    /**
     * Retrieves a data stream for a specific item
     * Downloads the .txt file from S3 and returns it as a readable stream
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @returns Readable stream of the data, or null if file doesn't exist
     */
    public async getDataStream(teamId: number, projectId: number, folderId: number, itemId: number): Promise<NodeJS.ReadableStream | null> {
        const data = await this.s3Sdk.downloadFile(`items/${teamId}/${projectId}/${folderId}/${itemId}.txt`);
        if (data?.Body) {
            return data.Body as NodeJS.ReadableStream;
        }
        return null;
    }

    /**
     * Saves a data stream for a specific item
     * Uploads the stream to S3 as a .txt file using multipart upload for large files
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param stream - Readable stream containing the data to save
     * @param contentLength - Optional content length in bytes
     * @throws Error if upload fails
     */
    public async saveDataStream(teamId: number, projectId: number, folderId: number, itemId: number, stream: Readable, contentLength?: number): Promise<void> {
        await this.s3Sdk.uploadStream(`items/${teamId}/${projectId}/${folderId}/${itemId}.txt`, stream, "text/plain", contentLength);
    }
}