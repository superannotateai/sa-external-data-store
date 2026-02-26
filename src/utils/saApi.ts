import https from "https";
import path from "path";
import SafeJSON from "./functions";
import { RequestOptions, SaAuthError, SaItem, SaUser } from "../types";

export type { SaAuthError, SaItem, SaUser } from "../types";

const SA_ITEM_API_HOST = "item.superannotate.com";
const SA_USER_API_HOST = "api.superannotate.com";

/**
 * Client for interacting with the SuperAnnotate API
 * Handles authentication and item retrieval
 */
export class SuperAnnotateApi {
    /**
     * Makes an HTTP request to the SuperAnnotate API
     * @param host - API host (e.g. item.superannotate.com)
     * @param endpoint - API endpoint path
     * @param method - HTTP method (GET, POST, PUT, DELETE)
     * @param options - Request options including headers and query parameters
     * @returns Promise resolving to the response data
     * @throws Error if the request fails or returns an error status
     */
    private static async request(
        host: string,
        endpoint: string,
        method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
        options: RequestOptions = {}
    ): Promise<unknown> {
        const urlObj = new URL("https://" + path.join(host, endpoint));

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
     * Retrieves an item from SuperAnnotate API
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param itemId - Item ID
     * @param authToken - Authorization token (Bearer token)
     * @returns Promise resolving to the item data
     * @throws SaAuthError if authentication fails or item is not found
     */
    public static async getItem(teamId: number, projectId: number, folderId: number, itemId: number, authToken: string): Promise<SaItem> {
        // Encode entity context as base64 for the API header
        // Using Buffer instead of btoa (browser API) for Node.js compatibility
        const entityContext = SafeJSON.stringify({
            team_id: teamId,
            project_id: projectId,
            folder_id: folderId,
        }) ?? "{}";
        const encodedContext = Buffer.from(entityContext).toString("base64");

        const itemResponse = await SuperAnnotateApi.request(SA_ITEM_API_HOST, `/api/v1/items/${itemId.toString()}`, "GET", {
            headers: {
                Authorization: authToken,
                "x-sa-entity-context": encodedContext,
            },
        }) as SaItem;

        return itemResponse;
    }

    /**
     * Retrieves the current user from SuperAnnotate API
     * @param authToken - Authorization token (Bearer token)
     * @returns Promise resolving to the current user data
     * @throws SaAuthError if authentication fails
     */
    public static async getMySAUser(authToken: string): Promise<SaUser> {
        const userResponse = await SuperAnnotateApi.request(SA_USER_API_HOST, `/api/v1/user/ME`, "GET", {
            headers: {
                Authorization: authToken,
            },
        });

        return userResponse as SaUser;
    }
}