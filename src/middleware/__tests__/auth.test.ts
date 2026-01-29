import { Request, Response } from "express";
import { saItemMiddleware } from "../auth";

jest.mock("../../utils/saApi", () => ({
    saApi: {
        getItem: jest.fn(),
    },
}));

import * as SaApi from "../../utils/saApi";

describe("saItemMiddleware", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            headers: {
                authorization: "Bearer token",
                "sa-team-id": "1",
                "sa-project-id": "2",
                "sa-folder-id": "3",
                "sa-item-id": "4",
                "sa-file-name": "file.pdf",
            },
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    it("should return 401 when authorization header is missing", async () => {
        delete req.headers!["authorization"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: "Unauthorized",
                message: "API key or authorization token is required",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when sa-team-id is missing", async () => {
        delete req.headers!["sa-team-id"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Team ID is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when sa-project-id is missing", async () => {
        delete req.headers!["sa-project-id"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Project ID is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when sa-folder-id is missing", async () => {
        delete req.headers!["sa-folder-id"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Folder ID is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when sa-item-id is missing", async () => {
        delete req.headers!["sa-item-id"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Item ID is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when sa-file-name is missing", async () => {
        delete req.headers!["sa-file-name"];

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "File name is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when team/project/folder IDs are not valid numbers", async () => {
        req.headers!["sa-team-id"] = "abc";

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Team ID, Project ID, and Folder ID must be valid numbers",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 404 when item is not found", async () => {
        (SaApi.saApi.getItem as jest.Mock).mockResolvedValue(null);

        await saItemMiddleware(req as Request, res as Response, next);

        expect(SaApi.saApi.getItem).toHaveBeenCalledWith(1, 2, 3, "4", "Bearer token");
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Item not found" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 on AuthException from API", async () => {
        (SaApi.saApi.getItem as jest.Mock).mockRejectedValue({
            error: { name: "AuthException", message: "Unauthorized" },
        });

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "You are not authorized to access this resource",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 500 on other API errors", async () => {
        (SaApi.saApi.getItem as jest.Mock).mockRejectedValue(new Error("Network error"));

        await saItemMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Failed to validate item access",
            })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should call next() when all validations pass and item exists", async () => {
        (SaApi.saApi.getItem as jest.Mock).mockResolvedValue({ id: 4 });

        await saItemMiddleware(req as Request, res as Response, next);

        expect(SaApi.saApi.getItem).toHaveBeenCalledWith(1, 2, 3, "4", "Bearer token");
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
