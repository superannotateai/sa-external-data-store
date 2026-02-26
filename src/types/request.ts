import { Request } from "express";

/**
 * Request extended with SA user ID (set by auth middleware)
 */
export type SaAuthorizedRequest = Request & {
    saUserId: string;
    saAccessToken: string;
};

/**
 * Request extended with SA file path (set by item path middleware)
 */
export type SaInternalRequest = SaAuthorizedRequest & {
    saFilePath: string;
};
