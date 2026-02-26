/**
 * Request options for API calls
 */
export type RequestOptions = {
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number | boolean>;
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

/** SuperAnnotate item (from items API) */
export type SaItem = {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};
