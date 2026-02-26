import { Request, Response } from "express";
import { PathValidatorMiddleware } from "../pathValidatorMiddleware";
import * as SaApi from "../../utils/saApi";
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
    },
}));

describe("PathValidatorMiddleware", () => {
    let req: any;
    let res: Partial<Response>;
    let next: jest.Mock;

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
            saAccessToken: "Bearer token",
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    it("should return 400 when team or project headers are missing", async () => {
        req.headers = { "sa-team-id": "1" };

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Team ID and Project ID are required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when neither item headers nor file path are provided", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
        };

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "File path is required" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should set saFilePath using sa-file-path header", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
            "sa-file-path": "folder/file.json",
        };

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect((req as any).saFilePath).toBe("1/2/folder/file.json");
        expect(next).toHaveBeenCalledTimes(1);
        expect(SaApi.SuperAnnotateApi.getItem).not.toHaveBeenCalled();
    });

    it("should set annotation path when folder and item headers are valid", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
            "sa-folder-id": "3",
            "sa-item-id": "4",
        };
        (SaApi.SuperAnnotateApi.getItem as jest.Mock).mockResolvedValue({ id: 4, name: "annotation item" });

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(SaApi.SuperAnnotateApi.getItem).toHaveBeenCalledWith(1, 2, 3, 4, "Bearer token");
        expect((req as any).saFilePath).toBe("1/2/3/4/annotation.json");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should return 401 when item lookup fails", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
            "sa-folder-id": "3",
            "sa-item-id": "4",
        };
        (SaApi.SuperAnnotateApi.getItem as jest.Mock).mockResolvedValue(null);

        await PathValidatorMiddleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Access to item is denied" })
        );
        expect(next).not.toHaveBeenCalled();
    });

    it("should propagate AuthException from item API", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
            "sa-folder-id": "3",
            "sa-item-id": "4",
        };
        (SaApi.SuperAnnotateApi.getItem as jest.Mock).mockRejectedValue({
            error: { name: "AuthException" },
        });

        await expect(
            PathValidatorMiddleware(req as Request, res as Response, next)
        ).rejects.toEqual({ error: { name: "AuthException" } });
        expect(res.status).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it("should propagate unexpected item API errors", async () => {
        req.headers = {
            "sa-team-id": "1",
            "sa-project-id": "2",
            "sa-folder-id": "3",
            "sa-item-id": "4",
        };
        const error = new Error("network");
        (SaApi.SuperAnnotateApi.getItem as jest.Mock).mockRejectedValue(error);

        await expect(
            PathValidatorMiddleware(req as Request, res as Response, next)
        ).rejects.toThrow("network");
        expect(res.status).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });
});
