import path from "path";
import fs from "fs";

jest.mock("../../middleware/localSignValidator", () => ({
    localSignValidator: (req: any, res: any, next: any) => {
        (req as any).filePath = req.query?.path ? decodeURIComponent(req.query.path as string) : undefined;
        next();
    },
}));

jest.mock("../../utils/config", () => ({
    Config: {
        localStoragePath: jest.fn(() => "/mock/storage"),
    },
}));

jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    existsSync: jest.fn(),
}));

import fileDownloadRouter from "../fileDownload";
import { Config } from "../../utils/config";

function getHandler() {
    const layer = fileDownloadRouter.stack.find(
        (l: any) => l.route && l.route.path === "/:fileName" && l.route.methods.get
    );
    if (!layer || !layer.route) throw new Error("No GET /:fileName handler found");
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
}

function createMockRes() {
    const res: any = {
        statusCode: 200,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(obj: any) {
            this._body = JSON.stringify(obj);
            return this;
        },
        sendFile(_path: string, callback?: (err: any) => void) {
            if (callback) callback(null);
            return this;
        },
    };
    return res;
}

function createMockReq(fileName: string, queryPath?: string) {
    const req: any = {
        params: { fileName },
        query: queryPath ? { path: queryPath } : {},
        filePath: queryPath ? decodeURIComponent(queryPath) : undefined,
    };
    return req;
}

describe("fileDownload routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Config.localStoragePath as jest.Mock).mockReturnValue("/mock/storage");
    });

    describe("GET /file/:fileName", () => {
        it("should return 400 when filePath is missing (no path query)", async () => {
            const handler = getHandler();
            const req = createMockReq("document.pdf");
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Bad Request",
                message: "File path missing or unauthorized",
            });
        });

        it("should return 404 when file does not exist", async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const handler = getHandler();
            const req = createMockReq("document.pdf", "items/1/2/3/4/document.pdf");
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "File does not exist",
            });
            expect(fs.existsSync).toHaveBeenCalledWith(
                path.join("/mock/storage", "items/1/2/3/4/document.pdf")
            );
        });

        it("should call sendFile when file exists", async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            const res = createMockRes();
            res.sendFile = jest.fn().mockImplementation((filePath: string, callback?: (err: any) => void) => {
                if (callback) setTimeout(() => callback(null), 0);
                return res;
            });
            const handler = getHandler();
            const req = createMockReq("document.pdf", "items/1/2/3/4/document.pdf");

            await handler(req, res, () => {});

            expect(fs.existsSync).toHaveBeenCalledWith(
                path.join("/mock/storage", "items/1/2/3/4/document.pdf")
            );
            expect(res.sendFile).toHaveBeenCalledWith(
                path.join("/mock/storage", "items/1/2/3/4/document.pdf"),
                expect.any(Function)
            );
        });
    });
});
