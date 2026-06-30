import { Request, Response } from "express";
import { PathValidatorMiddleware } from "../pathValidatorMiddleware";
import * as SaApi from "../../utils/saApi";
import { SaApiError } from "../../types/errors";
import { Config } from "../../utils/config";

jest.mock("../../utils/config", () => ({
    Config: {
        saPathHeaders: jest.fn(() => ({
            SA_TEAM_ID: "sa-team-id",
            SA_PROJECT_ID: "sa-project-id",
            SA_FOLDER_ID: "sa-folder-id",
            SA_ITEM_ID: "sa-item-id",
            SA_FILE_PATH: "sa-file-path",
        })),
    },
}));

jest.mock("../../utils/saApi", () => ({
    SuperAnnotateApi: {
        getItem: jest.fn(),
        getAnnotationPermissions: jest.fn(),
    },
}));

const getItem = SaApi.SuperAnnotateApi.getItem as jest.Mock;
const getPerms = SaApi.SuperAnnotateApi.getAnnotationPermissions as jest.Mock;

describe("PathValidatorMiddleware", () => {
    let req: any;
    let res: Partial<Response>;
    let next: jest.Mock;

    const fullHeaders = {
        "sa-team-id": "1",
        "sa-project-id": "2",
        "sa-folder-id": "3",
        "sa-item-id": "4",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (Config.saPathHeaders as jest.Mock).mockReturnValue({
            SA_TEAM_ID: "sa-team-id",
            SA_PROJECT_ID: "sa-project-id",
            SA_FOLDER_ID: "sa-folder-id",
            SA_ITEM_ID: "sa-item-id",
            SA_FILE_PATH: "sa-file-path",
        });
        req = {
            headers: {},
            method: "GET",
            baseUrl: "/storage",
            saAccessToken: "Bearer token",
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    it("should return 400 when any of team/project/folder/item is missing", async () => {
        req.headers = { "sa-team-id": "1", "sa-project-id": "2" };

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "VALIDATION_MISSING_HEADERS" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should resolve scope + name from getItem and call next (storage)", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockResolvedValue({ id: "4", name: "invoice_42" });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(getItem).toHaveBeenCalledWith(1, 2, 3, 4, "Bearer token");
        expect(getPerms).not.toHaveBeenCalled(); // storage route: item visibility is the gate
        expect(req.saScope).toBe("1/2/3");
        expect(req.saItemName).toBe("invoice_42");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should require annotation read permission on GET /annotation", async () => {
        req.baseUrl = "/annotation";
        req.headers = { ...fullHeaders };
        getItem.mockResolvedValue({ id: "4", name: "invoice_42" });
        getPerms.mockResolvedValue({ read: true, write: false });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(getPerms).toHaveBeenCalledWith(1, 2, 3, "Bearer token");
        expect(req.saItemName).toBe("invoice_42");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should require write permission on POST /annotation", async () => {
        req.baseUrl = "/annotation";
        req.method = "POST";
        req.headers = { ...fullHeaders };
        getItem.mockResolvedValue({ id: "4", name: "invoice_42" });
        getPerms.mockResolvedValue({ read: true, write: false });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "AUTH_ACCESS_DENIED" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should map AuthException from getItem to 401", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockRejectedValue({ error: { name: "AuthException", message: "bad token" } });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "AUTH_INVALID_TOKEN" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should map an SA 4xx error body from getItem to 403", async () => {
        req.headers = { ...fullHeaders };
        // SA error payloads are plain objects (not Error instances) -> access denied
        getItem.mockRejectedValue({ data: { message: "not found" } });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "AUTH_ACCESS_DENIED" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it.each([403, 404])("should map SaApiError %s from getItem to 403", async (status) => {
        req.headers = { ...fullHeaders };
        getItem.mockRejectedValue(new SaApiError(status, { message: "denied" }));

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "AUTH_ACCESS_DENIED" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should map SaApiError 401 from getItem to 401", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockRejectedValue(new SaApiError(401, { message: "bad token" }));

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "AUTH_INVALID_TOKEN" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should map SaApiError 5xx from getItem to 500", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockRejectedValue(new SaApiError(502, "upstream"));

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });

    it("should map a transport error from getItem to 500", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockRejectedValue(new Error("ECONNREFUSED"));

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });

    it("should reject an unsafe item name with 500 (no traversal)", async () => {
        req.headers = { ...fullHeaders };
        getItem.mockResolvedValue({ id: "4", name: "../../../etc/passwd" });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: "INTERNAL_ERROR" })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
