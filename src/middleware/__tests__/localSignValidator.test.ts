import { Request, Response } from "express";
import crypto from "crypto";
import { localSignValidator } from "../localSignValidator";

jest.mock("../../utils/config", () => ({
    Config: {
        localSignSecretKey: jest.fn(() => "test-secret-key"),
    },
}));

import { Config } from "../../utils/config";

describe("localSignValidator", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        (Config.localSignSecretKey as jest.Mock).mockReturnValue("test-secret-key");
        req = {
            query: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    function buildValidQuery(path: string, expiresOffsetMs: number = 3600000) {
        const expires = String(Date.now() + expiresOffsetMs);
        const dataToSign = `${path}-${expires}`;
        const signature = crypto
            .createHmac("sha256", "test-secret-key")
            .update(dataToSign)
            .digest("hex");
        return { path, expires, signature };
    }

    it("should return 400 when path is missing", async () => {
        req.query = { expires: "123", signature: "abc" };

        await localSignValidator(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith("Missing required parameters.");
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when expires is missing", async () => {
        req.query = { path: "items/1/2/3/4/file.pdf", signature: "abc" };

        await localSignValidator(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith("Missing required parameters.");
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 when signature is missing", async () => {
        req.query = { path: "items/1/2/3/4/file.pdf", expires: "123" };

        await localSignValidator(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith("Missing required parameters.");
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when URL has expired", async () => {
        const path = "items/1/2/3/4/file.pdf";
        const expires = String(Date.now() - 1000);
        const dataToSign = `${path}-${expires}`;
        const signature = crypto
            .createHmac("sha256", "test-secret-key")
            .update(dataToSign)
            .digest("hex");
        req.query = { path, expires, signature };

        await localSignValidator(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith("URL expired.");
        expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when signature is invalid", async () => {
        const path = "items/1/2/3/4/file.pdf";
        const expires = String(Date.now() + 3600000);
        req.query = { path, expires, signature: "wrong-signature" };

        await localSignValidator(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith("Invalid signature.");
        expect(next).not.toHaveBeenCalled();
    });

    it("should call next() and set req.filePath when signature is valid", async () => {
        const path = "items/1/2/3/4/document.pdf";
        req.query = buildValidQuery(path);

        await localSignValidator(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect((req as any).filePath).toBe("items/1/2/3/4/document.pdf");
        expect(res.status).not.toHaveBeenCalled();
    });

    it("should decode URI component for filePath", async () => {
        const path = "items%2F1%2F2%2F3%2F4%2Fmy%20file.pdf";
        req.query = buildValidQuery(path);

        await localSignValidator(req as Request, res as Response, next);

        expect((req as any).filePath).toBe(decodeURIComponent(path));
        expect(next).toHaveBeenCalled();
    });
});
