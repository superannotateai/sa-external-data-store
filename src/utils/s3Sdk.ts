import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, GetObjectCommandOutput, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { Config } from "./config";

/**
 * AWS S3 SDK wrapper class
 * Provides a simplified interface for common S3 operations
 * Handles authentication, error handling, and stream operations
 */
export class S3Sdk {
    private client: S3Client;
    private bucketName: string;

    /**
     * Creates a new S3Sdk instance
     * Initializes S3 client with credentials and region from configuration
     */
    constructor() {
        this.bucketName = Config.s3BucketName();
        this.client = new S3Client({
            region: Config.s3Region(),
            credentials: {
                accessKeyId: Config.s3AccessKeyId(),
                secretAccessKey: Config.s3SecretAccessKey(),
            },
        });
    }

    /**
     * Upload a file to S3
     * @param key - S3 object key (path)
     * @param body - File content as Buffer, Uint8Array, or string
     * @param contentType - Optional MIME type of the file
     * @throws Error if upload fails
     */
    public async uploadFile(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        await this.client.send(command);
    }

    /**
     * Upload a stream to S3 using multipart upload
     * 
     * This method handles large files by splitting them into 5MB parts.
     * Automatically handles cleanup on error by aborting the multipart upload.
     * 
     * @param key - S3 object key (path)
     * @param stream - Readable stream to upload
     * @param contentType - Optional MIME type of the stream
     * @param contentLength - Optional content length in bytes (helps with progress tracking)
     * @throws Error if upload fails (multipart upload will be aborted automatically)
     */
    public async uploadStream(key: string, stream: Readable, contentType?: string, contentLength?: number): Promise<void> {
        const partSize = 5 * 1024 * 1024; // 5 MB per part
        let uploadId: string | undefined;
        const parts: Array<{ ETag: string; PartNumber: number }> = [];

        try {
            // Step 1: Create multipart upload
            const createCommand = new CreateMultipartUploadCommand({
                Bucket: this.bucketName,
                Key: key,
                ContentType: contentType,
            });

            const createResponse = await this.client.send(createCommand);
            uploadId = createResponse.UploadId;

            if (!uploadId) {
                throw new Error("Failed to create multipart upload");
            }

            // Step 2: Upload parts
            let partNumber = 1;
            let buffer = Buffer.alloc(0);

            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

                // Upload part when buffer reaches partSize
                while (buffer.length >= partSize) {
                    const partBuffer = buffer.subarray(0, partSize);
                    buffer = buffer.subarray(partSize);

                    const uploadPartCommand = new UploadPartCommand({
                        Bucket: this.bucketName,
                        Key: key,
                        PartNumber: partNumber,
                        UploadId: uploadId,
                        Body: partBuffer,
                    });

                    const uploadPartResponse = await this.client.send(uploadPartCommand);
                    
                    if (!uploadPartResponse.ETag) {
                        throw new Error(`Failed to upload part ${partNumber}`);
                    }

                    parts.push({
                        ETag: uploadPartResponse.ETag,
                        PartNumber: partNumber,
                    });

                    partNumber++;
                }
            }

            // Step 3: Upload remaining buffer as final part
            if (buffer.length > 0) {
                const uploadPartCommand = new UploadPartCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    PartNumber: partNumber,
                    UploadId: uploadId,
                    Body: buffer,
                });

                const uploadPartResponse = await this.client.send(uploadPartCommand);
                
                if (!uploadPartResponse.ETag) {
                    throw new Error(`Failed to upload final part ${partNumber}`);
                }

                parts.push({
                    ETag: uploadPartResponse.ETag,
                    PartNumber: partNumber,
                });
            }

            // Step 4: Complete multipart upload
            const completeCommand = new CompleteMultipartUploadCommand({
                Bucket: this.bucketName,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: {
                    Parts: parts,
                },
            });

            await this.client.send(completeCommand);
        } catch (error) {
            // Cleanup: Abort multipart upload on error
            if (uploadId) {
                try {
                    const abortCommand = new AbortMultipartUploadCommand({
                        Bucket: this.bucketName,
                        Key: key,
                        UploadId: uploadId,
                    });
                    await this.client.send(abortCommand);
                } catch (abortError) {
                    // Log but don"t throw - original error is more important
                    console.error("Failed to abort multipart upload:", abortError);
                }
            }
            throw error;
        }
    }

    /**
     * Download a file from S3
     * @param key - S3 object key (path)
     * @returns GetObjectCommandOutput with file data, or null if file doesn't exist
     * @throws Error if download fails (except for NoSuchKey which returns null)
     */
    public async downloadFile(key: string): Promise<GetObjectCommandOutput | null> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            return await this.client.send(command);
        } catch (error: any) {
            if (error.name === "NoSuchKey") {
                return null;
            }
            throw error;
        }
    }

    /**
     * Delete a file from S3
     * @param key - S3 object key (path)
     * @throws Error if deletion fails
     */
    public async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        await this.client.send(command);
    }

    /**
     * List objects in S3 bucket with optional prefix
     * @param prefix - Optional prefix to filter objects (e.g., "items/1/2/")
     * @param maxKeys - Optional maximum number of keys to return
     * @returns Array of object keys (paths)
     */
    public async listObjects(prefix?: string, maxKeys?: number): Promise<string[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: maxKeys,
        });

        const response = await this.client.send(command);
        return response.Contents?.map((object) => object.Key || "") || [];
    }

    /**
     * Get object metadata without downloading the file
     * @param key - S3 object key (path)
     * @returns Object metadata including content type, size, modification date, and ETag
     * @throws Error if object doesn't exist or request fails
     */
    public async getObjectMetadata(key: string): Promise<{
        contentType?: string;
        contentLength?: number;
        lastModified?: Date;
        etag?: string;
    }> {
        const command = new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.client.send(command);
        return {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            lastModified: response.LastModified,
            etag: response.ETag,
        };
    }

    /**
     * Check if an object exists in S3
     * @param key - S3 object key (path)
     * @returns true if object exists, false if not found
     * @throws Error if request fails (other than 404)
     */
    public async objectExists(key: string): Promise<boolean> {
        try {
            await this.getObjectMetadata(key);
            return true;
        } catch (error: any) {
            if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Generate a presigned URL for getting an object
     * Presigned URLs allow temporary access to S3 objects without AWS credentials
     * @param key - S3 object key (path)
     * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
     * @returns Presigned URL string
     */
    public async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        return await getSignedUrl(this.client, command, { expiresIn });
    }

    /**
     * Generate a presigned URL for putting an object
     * Presigned URLs allow temporary upload access to S3 without AWS credentials
     * @param key - S3 object key (path)
     * @param contentType - Optional MIME type for the upload
     * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
     * @returns Presigned URL string
     */
    public async getPresignedUploadUrl(key: string, contentType?: string, expiresIn: number = 3600): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType,
        });

        return await getSignedUrl(this.client, command, { expiresIn });
    }
}

