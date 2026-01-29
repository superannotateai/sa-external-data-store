import "dotenv/config";

/**
 * Configuration management class
 * Provides type-safe access to environment variables
 * All methods throw errors if required environment variables are not set
 */
export class Config {
    /**
     * Gets the data store type from environment variables
     * @returns Data store type (e.g., "S3")
     * @throws Error if DATA_STORE is not set
     */
    static dataStore(): string {
        if (!process.env.DATA_STORE) {
            throw new Error("DATA_STORE is not set");
        }

        return process.env.DATA_STORE;
    }

    /**
     * Gets the S3 bucket name from environment variables
     * @returns S3 bucket name
     * @throws Error if S3_BUCKET_NAME is not set
     */
    static s3BucketName(): string {
        if (!process.env.S3_BUCKET_NAME) {
            throw new Error("S3_BUCKET_NAME is not set");
        }

        return process.env.S3_BUCKET_NAME;
    }

    /**
     * Gets the S3 access key ID from environment variables
     * @returns AWS access key ID
     * @throws Error if S3_ACCESS_KEY_ID is not set
     */
    static s3AccessKeyId(): string {
        if (!process.env.S3_ACCESS_KEY_ID) {
            throw new Error("S3_ACCESS_KEY_ID is not set");
        }

        return process.env.S3_ACCESS_KEY_ID;
    }

    /**
     * Gets the S3 secret access key from environment variables
     * @returns AWS secret access key
     * @throws Error if S3_SECRET_ACCESS_KEY is not set
     */
    static s3SecretAccessKey(): string {
        if (!process.env.S3_SECRET_ACCESS_KEY) {
            throw new Error("S3_SECRET_ACCESS_KEY is not set");
        }

        return process.env.S3_SECRET_ACCESS_KEY;
    }

    /**
     * Gets the S3 region from environment variables
     * @returns AWS region (e.g., "us-east-1")
     * @throws Error if S3_REGION is not set
     */
    static s3Region(): string {
        if (!process.env.S3_REGION) {
            throw new Error("S3_REGION is not set");
        }

        return process.env.S3_REGION;
    }

    /**
     * Gets the SuperAnnotate authentication host from environment variables
     * @returns SuperAnnotate API host (without protocol)
     * @throws Error if SA_AUTH_HOST is not set
     */
    static SaAuthHost(): string {
        if (!process.env.SA_AUTH_HOST) {
            throw new Error("SA_AUTH_HOST is not set");
        }

        return process.env.SA_AUTH_HOST;
    }

    /**
     * Gets the local storage path from environment variables
     * @returns Local storage base directory path
     * @throws Error if LOCAL_STORAGE_PATH is not set
     */
    static localStoragePath(): string {
        if (!process.env.LOCAL_STORAGE_PATH) {
            throw new Error("LOCAL_STORAGE_PATH is not set");
        }

        return process.env.LOCAL_STORAGE_PATH;
    }

    /**
     * Gets the sign url expiration time seconds from environment variables
     * @returns Local storage base directory path
     * @throws Error if SIGN_URL_EXPIRATION_TIME_HR is not set
     */
    static signUrlExpirationTimeHr(): number {
        if (!process.env.SIGN_URL_EXPIRATION_TIME_HR) {
            throw new Error("SIGN_URL_EXPIRATION_TIME_HR is not set");
        }

        return parseInt(process.env.SIGN_URL_EXPIRATION_TIME_HR);
    }

    /**
     * Gets the local sign secret key from environment variables
     * @returns Local sign secret key
     * @throws Error if LOCAL_SIGN_SECRET_KEY is not set
     */
    static localSignSecretKey(): string {
        if (!process.env.LOCAL_SIGN_SECRET_KEY) {
            throw new Error("LOCAL_SIGN_SECRET_KEY is not set");
        }

        return process.env.LOCAL_SIGN_SECRET_KEY;
    }
}