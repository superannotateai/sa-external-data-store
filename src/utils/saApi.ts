import https from "https";
import path from "path";
import SafeJSON from "./functions";
import { AnnotationPermissions, RequestOptions, SaAggregateAccessesResponse, SaAuthError, SaUser } from "../types";

export type { AnnotationPermissions, SaAuthError, SaUser } from "../types";

const SA_ITEM_API_HOST = "item.devsuperannotate.com";
const SA_USER_API_HOST = "api.devsuperannotate.com";
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