import "dotenv/config";
import { DataStoreType } from "../types";

/**
 * Configuration management class
 * Provides type-safe access to environment variables
 * All methods throw errors if required environment variables are not set
 */
export class Config {
    /**
     * Gets the data store type from environment variables
     * @returns Data store type ("S3" or "LOCAL")
     * @throws Error if DATA_STORE is not set or invalid
     */
    static dataStore(): DataStoreType {
        if (!process.env.DATA_STORE) {
            throw new Error("DATA_STORE is not set");
        }

        const value = process.env.DATA_STORE;
        if (value !== "S3" && value !== "LOCAL") {
            throw new Error(`Invalid data store: ${value}. Valid options are: S3, LOCAL`);
        }

        return value;
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
     * Gets the S3 prefix from environment variables
     * @returns S3 prefix
     * @throws Error if S3_PREFIX is not set
     */
    static s3Prefix(): string {
        if (!process.env.S3_PREFIX) {
            throw new Error("S3_PREFIX is not set");
        }

        return process.env.S3_PREFIX;
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
     * Gets the signed URL expiration time in hours from environment variables
     * @returns Expiration time in hours for signed URLs
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

    /**
     * Gets the SuperAnnotate access token header name
     * @returns SuperAnnotate access token header name
     */
    static saAuthHeader(): string {
        return "x-sa-access-token";
    }

    /**
     * Gets the SuperAnnotate file path headers
     * @returns SuperAnnotate file path headers
     */
    static saPathHeaders(): Record<string, string> {
        return {
            SA_TEAM_ID: "sa-team-id",
            SA_PROJECT_ID: "sa-project-id",
            SA_FOLDER_ID: "sa-folder-id",
            SA_ITEM_ID: "sa-item-id",
            SA_FILE_PATH: "sa-file-path",
        };
    }

    /**
     * Resolves a SuperAnnotate API host from the environment.
     * The host is the trust anchor for all authN/authZ decisions, so it must be
     * explicitly configured in production. A dev default is only used outside
     * production to keep local development working.
     * @throws Error in production when the variable is not set
     */
    private static saApiHost(envVar: string, devDefault: string): string {
        const value = process.env[envVar];
        if (value) {
            return value;
        }
        if (process.env.NODE_ENV === "production") {
            throw new Error(`${envVar} is not set`);
        }
        return devDefault;
    }

    /**
     * Gets the SuperAnnotate item API host (e.g. item.superannotate.com)
     * @returns Item API host
     * @throws Error if SA_ITEM_API_HOST is not set in production
     */
    static saItemApiHost(): string {
        return Config.saApiHost("SA_ITEM_API_HOST", "item.superannotate.com");
    }

    /**
     * Gets the SuperAnnotate user API host (e.g. api.superannotate.com)
     * @returns User API host
     * @throws Error if SA_USER_API_HOST is not set in production
     */
    static saUserApiHost(): string {
        return Config.saApiHost("SA_USER_API_HOST", "api.superannotate.com");
    }

    /**
     * Gets the public-facing protocol used when building signed URLs.
     * Defaults to "http" so local development keeps working; set PUBLIC_PROTOCOL
     * to "https" in any environment served over TLS (e.g. behind a proxy).
     * @returns "http" or "https"
     */
    static publicProtocol(): string {
        return process.env.PUBLIC_PROTOCOL || "http";
    }

    /**
     * Gets the public-facing host[:port] used when building signed URLs.
     * Must be set explicitly in production so URLs don't depend on the request's
     * (possibly proxied) Host header; a dev default keeps local development working.
     * @returns Public host, including port when non-standard
     * @throws Error in production when PUBLIC_HOST is not set
     */
    static publicHost(): string {
        const value = process.env.PUBLIC_HOST;
        if (value) {
            return value;
        }
        if (process.env.NODE_ENV === "production") {
            throw new Error("PUBLIC_HOST is not set");
        }
        return `localhost:${process.env.PORT || 3005}`;
    }

    /**
     * Builds the public base URL (protocol + host) used as the prefix for signed URLs.
     * @returns e.g. "https://data.example.com"
     */
    static publicBaseUrl(): string {
        return `${Config.publicProtocol()}://${Config.publicHost()}`;
    }
}