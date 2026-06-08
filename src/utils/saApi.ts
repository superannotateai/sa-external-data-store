import https from "https";
import path from "path";
import SafeJSON from "./functions";
import { Config } from "./config";
import { AnnotationPermissions, RequestOptions, SaAggregateAccessesResponse, SaAuthError, SaItem, SaUser } from "../types";
import { SaApiError } from "../types/errors";

export type { AnnotationPermissions, SaAuthError, SaItem, SaUser } from "../types";
export { SaApiError } from "../types/errors";

// Resolved once at startup: the SuperAnnotate hosts are static for the process
// lifetime. This also fails fast on misconfiguration (e.g. missing host in
// production) instead of erroring on the first request.
const SA_ITEM_API_HOST = Config.saItemApiHost();
const SA_USER_API_HOST = Config.saUserApiHost();
const SA_USER_AGENT = "SA External Data Store";

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

        // User-Agent is enforced for all SuperAnnotate API calls and cannot be overridden by callers
        const headers: Record<string, string> = { ...(options.headers || {}), "User-Agent": SA_USER_AGENT };
        let bodyBuffer: Buffer | undefined;
        if (options.body !== undefined) {
            const serialized = SafeJSON.stringify(options.body) ?? "";
            bodyBuffer = Buffer.from(serialized, "utf8");
            if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
                headers["Content-Type"] = "application/json";
            }
            headers["Content-Length"] = String(bodyBuffer.length);
        }

        const requestOptions: https.RequestOptions = {
            method,
            headers,
        };

        return new Promise((resolve, reject) => {
            const req = https.request(urlObj, requestOptions, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    try {
                        const statusCode = res.statusCode ?? 0;
                        const contentType = res.headers["content-type"];
                        const isJson = !!contentType && contentType.includes("application/json");
                        const body: unknown = isJson ? SafeJSON.parse(data) : data;

                        if (statusCode >= 400) {
                            // Surface the HTTP status so callers can map it correctly
                            // instead of inferring intent from the body shape.
                            reject(new SaApiError(statusCode, body));
                        } else {
                            resolve(body);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on("error", (e) => {
                reject(e);
            });

            if (bodyBuffer) {
                req.write(bodyBuffer);
            }

            req.end();
        });
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
     * Resolves annotation read/write permissions for the current user
     * Calls POST item.devsuperannotate.com/api/v1/items/aggregateAccesses and
     * inspects data.actions for GetItemAnnotation (read) and EditItemAnnotation (write)
     * @param teamId - Team ID
     * @param projectId - Project ID
     * @param folderId - Folder ID
     * @param authToken - Authorization token (Bearer token)
     * @returns Annotation permissions ({ read, write })
     * @throws SaAuthError if authentication fails
     */
    public static async getAnnotationPermissions(
        teamId: number,
        projectId: number,
        folderId: number,
        authToken: string
    ): Promise<AnnotationPermissions> {
        const entityContext = SafeJSON.stringify({
            team_id: teamId,
            project_id: projectId,
            folder_id: folderId,
        }) ?? "{}";
        const encodedContext = Buffer.from(entityContext).toString("base64");

        const response = await SuperAnnotateApi.request(SA_ITEM_API_HOST, `/api/v1/items/aggregateAccesses`, "POST", {
            headers: {
                Authorization: authToken,
                "x-sa-entity-context": encodedContext,
            },
        }) as SaAggregateAccessesResponse;

        const actions = response?.data?.actions ?? [];
        return {
            read: actions.includes("GetItemAnnotation"),
            write: actions.includes("EditItemAnnotation"),
        };
    }
}