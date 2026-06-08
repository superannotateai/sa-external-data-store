/**
 * Request options for API calls
 */
export type RequestOptions = {
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number | boolean>;
    body?: unknown;
};

/** Annotation permissions resolved from SuperAnnotate aggregate accesses */
export type AnnotationPermissions = {
    read: boolean;
    write: boolean;
};

/**
 * Error type for SuperAnnotate authentication errors
 */
export type SaAuthError = {
    error: {
        name: string;
        message: string;
    };
};

/** SuperAnnotate user (from /api/v1/user/ME) */
export type SaUser = {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
};

/** Response shape from POST /api/v1/items/aggregateAccesses */
export type SaAggregateAccessesResponse = {
    data: {
        actions: string[];
    };
};

/** SuperAnnotate item (from items API) */
export type SaItem = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};

/**
 * Manifest stored at items/{team}/{project}/{folder}/<item_name>.json.
 * `files` is the authoritative allowlist of raw assets (under the files/ root)
 * that belong to the item and may be signed for download.
 */
export type SaItemManifest = {
    label?: string;
    files: string[];
    metadata?: unknown;
};