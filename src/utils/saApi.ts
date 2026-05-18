import https from "https";
import { URL } from "url";
import SafeJSON from "./json";
import { Config } from "./config";

/**
 * Request options for API calls
 */
type RequestOptions = {
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

/**
 * Client for interacting with the SuperAnnotate API
 * Handles authentication and item retrieval
 *
 * Different SuperAnnotate services live on different subdomains of SA_HOST:
 * - api.{SA_HOST}  - general API (e.g. /api/v1/me)
 * - item.{SA_HOST} - item service (e.g. /api/v1/items/{id})
 */
class SuperAnnotateApi {
    /**
     * Makes an HTTP request to the SuperAnnotate API
     * @param host - Fully qualified host (without protocol)
     * @param endpoint - API endpoint path
     * @param method - HTTP method (GET, POST, PUT, DELETE)
     * @param options - Request options including headers and query parameters
     * @returns Promise resolving to the response data
     * @throws Error if the request fails or returns an error status
     */
    private async request(
        host: string,
        endpoint: string,
        method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
        options: RequestOptions = {}
    ): Promise<unknown> {
        const urlObj = new URL(`https://${host}${endpoint}`);

        // Append query parameters if present
        if (options.queryParams) {
            Object.entries(options.queryParams).forEach(([key, value]) => {
                urlObj.searchParams.append(key, String(value));
            });
        }

        const requestOptions: https.RequestOptions = {
            method,
            headers: options.headers || {},
        };

        return new Promise((resolve, reject) => {
            const req = https.request(urlObj, requestOptions, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    try {
                        const contentType = res.headers["content-type"];
                        if (contentType && contentType.includes("application/json")) {
                            if (res?.statusCode && res?.statusCode >= 400) {
                                reject(SafeJSON.parse(data));
                            } else {
                                resolve(SafeJSON.parse(data));
                            }
                        } else {
                            if (res?.statusCode && res?.statusCode >= 400) {
                                reject(data);
                            } else {
                                resolve(data);
                            }
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on("error", (e) => {
                reject(e);
            });

            req.end();
        });
    }

    /**
     * Retrieves the currently authenticated user from SuperAnnotate API
     * Used as a lightweight auth-only check that does not require entity context
     * Calls api.{SA_HOST}
     * @param authToken - Authorization token (Bearer token)
     * @returns Promise resolving to the current user data
     * @throws SaAuthError if authentication fails
     */
    public async getMe(authToken: string): Promise<unknown> {
        return this.request(`api.${Config.SaHost()}`, `/api/v1/user/ME`, "GET", {
            headers: {
                Authorization: authToken,
            },
        });
    }

    /**
     * Retrieves an item from SuperAnnotate API
     * Calls item.{SA_HOST}
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param authToken - Authorization token (Bearer token)
     * @returns Promise resolving to the item data
     * @throws SaAuthError if authentication fails or item is not found
     */
    public async getItem(teamId: number, projectId: number, folderId: number, itemId: string, authToken: string): Promise<unknown> {
        // Encode entity context as base64 for the API header
        // Using Buffer instead of btoa (browser API) for Node.js compatibility
        const entityContext = SafeJSON.stringify({
            team_id: teamId,
            project_id: projectId,
            folder_id: folderId,
        }) ?? "{}";
        const encodedContext = Buffer.from(entityContext).toString("base64");

        return this.request(`item.${Config.SaHost()}`, `/api/v1/items/${itemId}`, "GET", {
            headers: {
                Authorization: authToken,
                "x-sa-entity-context": encodedContext,
            },
        });
    }
}

const saApi = new SuperAnnotateApi();

export { saApi };