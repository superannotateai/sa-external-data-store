import { Request } from "express";

/**
 * Request extended with SA user ID (set by auth middleware)
 */
export type SaAuthorizedRequest = Request & {
    saUserId: string;
    saAccessToken: string;
};

/**
 * Request extended with the resolved SuperAnnotate item location
 * (set by PathValidatorMiddleware after an authoritative SA lookup).
 *
 * - saScope: "{teamId}/{projectId}/{folderId}" (numeric, safe segments)
 * - saItemName: the validated, single-segment item name from SuperAnnotate
 */
export type SaInternalRequest = SaAuthorizedRequest & {
    saScope: string;
    saItemName: string;
};
