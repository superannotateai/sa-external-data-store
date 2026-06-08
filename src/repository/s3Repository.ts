import { Config } from "../utils/config";
import { S3Sdk } from "../utils/s3Sdk";
import { isUnsafeRelativePath } from "../utils/pathSafety";
import { AppError } from "../types/errors";
import { SaItemManifest } from "../types";
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

    private assertSafePath(relativePath: string): void {
        if (isUnsafeRelativePath(relativePath)) {
            throw new AppError("Invalid file path", 400, "VALIDATION_INVALID_PATH");
        }
    }

    /**
     * Checks if a file exists in the storage
     * @param path - Relative path to the file
     * @returns true if file exists, false if not
     */
    public async isFileExists(path: string): Promise<boolean> {
        this.assertSafePath(path);
        return await this.s3Sdk.objectExists(`${Config.s3Prefix()}/${path}`);
    }

    /**
     * Deletes an object in S3 by key
     * @param teamId - Team ID (used to build key)
     * @param projectId - Project ID (used to build key)
     * @param folderId - Folder ID (used to build key)
     * @param itemId - Item ID (used to build key; object key is items/.../itemId.json)
     * @throws Error if deletion fails
     */
    public async deleteData(teamId: number, projectId: number, folderId: number, itemId: number): Promise<void> {
        await this.s3Sdk.deleteFile(`${Config.s3Prefix()}/${teamId}/${projectId}/${folderId}/${itemId}.json`);
    }

    /**
     * Lists all data keys for a specific folder
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @returns Array of S3 object keys (file paths) in the folder
     */
    public async listData(teamId: number, projectId: number, folderId: number): Promise<string[]> {
        return await this.s3Sdk.listObjects(`${Config.s3Prefix()}/${teamId}/${projectId}/${folderId}`);
    }

    /**
     * Retrieves a data stream for a path
     * Downloads the object from S3 and returns it as a readable stream
     * @param path - Relative path to the file (S3 key under items/)
     * @returns Readable stream of the data, or null if object doesn't exist
     */
    public async getDataStream(path: string): Promise<NodeJS.ReadableStream | null> {
        this.assertSafePath(path);
        const data = await this.s3Sdk.downloadFile(`${Config.s3Prefix()}/${path}`);
        if (data?.Body) {
            return data.Body as NodeJS.ReadableStream;
        }
        return null;
    }

    /**
     * Saves a data stream for a specific item
     * Uploads the stream to S3 as a .txt file using multipart upload for large files
     * @param path - Relative path to the file
     * @param stream - Readable stream containing the data to save
     * @throws Error if upload fails
     */
    public async saveDataStream(path: string, stream: Readable): Promise<void> {
        this.assertSafePath(path);
        await this.s3Sdk.uploadStream(`${Config.s3Prefix()}/${path}`, stream, "text/plain");
    }

    /**
     * Retrieves a signed URL for a specific item
     * @param path - Relative path to the file
     * @returns Signed URL
     */
    public async getSignedUrl(path: string, _host?: string): Promise<string> {
        this.assertSafePath(path);
        const signedUrl = await this.s3Sdk.getPresignedUrl(`${Config.s3Prefix()}/${path}`);
        return signedUrl;
    }

    /**
     * Returns the S3 object key for a path (items/ + path)
     * @param path - Relative path to the file
     * @returns S3 object key (e.g. items/1/2/file.json)
     */
    public getFilePath(path: string): string {
        return `${Config.s3Prefix()}/${path}`;
    }

    public async validateSignature(_path: string, _expires: string, _signature: string): Promise<boolean> {
        // S3 signed URLs are validated by AWS at request time.
        return true;
    }

    private notSupported(): never {
        throw new AppError(
            "Manifest-based storage is only supported with the LOCAL data store",
            501,
            "NOT_SUPPORTED"
        );
    }

    public async readManifest(_itemsRelativePath: string): Promise<SaItemManifest | null> {
        this.notSupported();
    }

    public async readAccessMap(_projectScope: string, _itemName: string): Promise<SaItemManifest | null> {
        this.notSupported();
    }

    public async filesExists(_filesRelativePath: string): Promise<boolean> {
        this.notSupported();
    }

    public async getFilesStream(_filesRelativePath: string): Promise<NodeJS.ReadableStream | null> {
        this.notSupported();
    }

    public getFilesSignedUrl(_filesRelativePath: string, _host: string): string {
        this.notSupported();
    }

    public async validateFilesSignature(_filesRelativePath: string, _expires: string, _signature: string): Promise<boolean> {
        // No HMAC capability scheme in S3 mode.
        return false;
    }

    /**
     * Verifies the S3 bucket is reachable with the configured credentials
     * @throws Error if the bucket cannot be reached
     */
    public async checkConnection(): Promise<void> {
        await this.s3Sdk.checkConnection();
    }
}