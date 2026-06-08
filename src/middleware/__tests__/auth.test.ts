import { Request, Response } from "express";
import { AuthSaMiddleware } from "../authSaMiddleware";
import * as SaApi from "../../utils/saApi";
import { SaApiError } from "../../types/errors";
import { Config } from "../../utils/config";

jest.mock("../../utils/saApi", () => ({
    SuperAnnotateApi: {
        getMySAUser: jest.fn(),
    },
}));

jest.mock("../../utils/config", () => ({
    Config: {
        saAuthHeader: jest.fn(() => "x-sa-access-token"),
    },
}));

describe("AuthSaMiddleware", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (Config.saAuthHeader as jest.Mock).mockReturnValue("x-sa-access-token");
        req = {
            headers: {
                "x-sa-access-token": "Bearer token",
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    it("should return 401 when authorization header is missing", async () => {
        delete req.headers!["x-sa-access-token"];

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: "Unauthorized",
                message: "API key or authorization token is required",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not found or invalid", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockResolvedValue(null);

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(SaApi.SuperAnnotateApi.getMySAUser).toHaveBeenCalledWith("Bearer token");
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Invalid or expired authorization token",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user has no id", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockResolvedValue({ email: "a@b.com" });

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Invalid or expired authorization token",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 on AuthException from API", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockRejectedValue({
            error: { name: "AuthException", message: "Unauthorized" },
        });

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Invalid or expired authorization token",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 on other API errors", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockRejectedValue(new Error("Network error"));

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Failed to validate authorization",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it.each([401, 403])("should return 401 when SuperAnnotate responds with %s", async (status) => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockRejectedValue(new SaApiError(status, { message: "nope" }));

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Invalid or expired authorization token" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 when SuperAnnotate responds with a 5xx", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockRejectedValue(new SaApiError(503, "upstream down"));

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Failed to validate authorization" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should call next() and set req.saUserId when user is valid", async () => {
        (SaApi.SuperAnnotateApi.getMySAUser as jest.Mock).mockResolvedValue({ id: "user-123", email: "u@b.com" });

        await AuthSaMiddleware(req as Request, res as Response, next);

        expect(SaApi.SuperAnnotateApi.getMySAUser).toHaveBeenCalledWith("Bearer token");
        expect((req as any).saUserId).toBe("user-123");
        expect((req as any).saAccessToken).toBe("Bearer token");
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
