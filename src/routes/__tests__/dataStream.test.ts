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

function createMockReq(options: { method?: string; body?: Buffer; saScope?: string; saItemName?: string } = {}) {
    const req: any = {
        method: options.method || "GET",
        headers: {},
        saScope: options.saScope ?? "1/2/3",
        saItemName: options.saItemName ?? "invoice_42",
        on() {
            return this;
        },
    };
    if (options.body) {
        const stream = new Readable({ read() {} });
        stream.push(options.body);
        stream.push(null);
        Object.assign(req, stream);
    }
    return req;
}

describe("annotation routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /annotation", () => {
        it("should return 404 when annotation stream not found", async () => {
            mockGetDataStream.mockResolvedValue(null);
            const handler = getHandler("get");
            const res = createMockRes();

            await handler(createMockReq(), res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({ message: "Data stream not found" });
            expect(mockGetDataStream).toHaveBeenCalledWith("1/2/3/invoice_42_annotation.json");
        });

        it("should stream the annotation file built from scope + name", async () => {
            const stream = new Readable({ read() {} });
            mockGetDataStream.mockResolvedValue(stream);
            const handler = getHandler("get");
            const res = createMockRes();

            await handler(createMockReq({ saItemName: "doc.txt" }), res, () => {});

            expect(res.statusCode).toBe(200);
            expect(res._headers["Content-Type"]).toBe("application/json");
            expect(mockGetDataStream).toHaveBeenCalledWith("1/2/3/doc.txt_annotation.json");
        });
    });

    describe("POST /annotation", () => {
        it("should save the request stream to the annotation path", async () => {
            mockSaveDataStream.mockResolvedValue(undefined);
            const handler = getHandler("post");
            const res = createMockRes();

            await handler(createMockReq({ method: "POST", body: Buffer.from("content") }), res, () => {});

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res._body)).toMatchObject({ message: "Data stream saved successfully" });
            const call = mockSaveDataStream.mock.calls[0];
            expect(call[0]).toBe("1/2/3/invoice_42_annotation.json");
            expect(call[1]).toBeDefined();
        });
    });
});
