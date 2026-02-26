import { Readable } from "stream";

jest.mock("../../middleware/authSaMiddleware", () => ({
    AuthSaMiddleware: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../../middleware/pathValidatorMiddleware", () => ({
    PathValidatorMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const mockGetDataStream = jest.fn();
const mockSaveDataStream = jest.fn();

jest.mock("../../repository", () => ({
    __esModule: true,
    default: {
        getDataStream: (...args: any[]) => mockGetDataStream(...args),
        saveDataStream: (...args: any[]) => mockSaveDataStream(...args),
    },
}));

import dataStreamRouter from "../annotationRouter";

function getHandler(method: "get" | "post") {
    const layer = dataStreamRouter.stack.find(
        (l: any) => l.route && l.route.path === "/" && l.route.methods[method]
    );
    if (!layer || !layer.route) throw new Error(`No ${method} / handler found`);
    const stack = layer.route.stack;
    return stack[stack.length - 1].handle;
}

function createMockRes() {
    const res: any = {
        statusCode: 200,
        _headers: {},
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(obj: any) {
            this._body = JSON.stringify(obj);
            return this;
        },
        setHeader(k: string, v: string) {
            this._headers[k] = v;
            return this;
        },
        write() {},
        end() {},
        get headersSent() {
            return !!this._body;
        },
    };
    res._headers = {};
    return res;
}

function createMockReq(options: { method?: string; headers?: Record<string, string>; body?: Buffer; saFilePath?: string } = {}) {
    const headers = options.headers || {};
    const req: any = {
        method: options.method || "GET",
        headers,
        on() {
            return this;
        },
    };
    if (options.saFilePath !== undefined) {
        req.saFilePath = options.saFilePath;
    }
    if (options.body) {
        const stream = new Readable({ read() {} });
        stream.push(options.body);
        stream.push(null);
        Object.assign(req, stream);
    }
    return req;
}

describe("dataStream routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /dataStream", () => {
        it("should return 400 when required headers are missing", async () => {
            const handler = getHandler("get");
            const req = createMockReq({ headers: { "sa-team-id": "1" } });
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Bad Request",
                message: "Invalid or missing required headers",
            });
            expect(mockGetDataStream).not.toHaveBeenCalled();
        });

        it("should return 404 when stream not found", async () => {
            mockGetDataStream.mockResolvedValue(null);
            const handler = getHandler("get");
            const req = createMockReq({ saFilePath: "1/2/3/4/document.pdf" });
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "Data stream not found",
            });
            expect(mockGetDataStream).toHaveBeenCalledWith("1/2/3/4/document.pdf");
        });

        it("should set stream headers when stream exists", async () => {
            const stream = new Readable({ read() {} });
            mockGetDataStream.mockResolvedValue(stream);
            const handler = getHandler("get");
            const req = createMockReq({ saFilePath: "1/2/3/4/document.txt" });
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(200);
            expect(res._headers["Content-Type"]).toBe("text/plain");
            expect(mockGetDataStream).toHaveBeenCalledWith("1/2/3/4/document.txt");
        });
    });

    describe("POST /dataStream", () => {
        it("should return 400 when required headers are missing", async () => {
            const handler = getHandler("post");
            const req = createMockReq({ headers: { "sa-team-id": "1" }, body: Buffer.from("body") });
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Bad Request",
                message: "Invalid or missing required headers",
            });
            expect(mockSaveDataStream).not.toHaveBeenCalled();
        });

        it("should return 200 and save stream when headers are valid", async () => {
            mockSaveDataStream.mockResolvedValue(undefined);
            const handler = getHandler("post");
            const req = createMockReq({
                body: Buffer.from("file content"),
                saFilePath: "1/2/3/4/document.pdf",
            });
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res._body)).toMatchObject({
                message: "Data stream saved successfully",
            });
            expect(mockSaveDataStream).toHaveBeenCalledTimes(1);
            const call = mockSaveDataStream.mock.calls[0];
            expect(call[0]).toBe("1/2/3/4/document.pdf");
            expect(call[1]).toBeDefined();
        });
    });
});
