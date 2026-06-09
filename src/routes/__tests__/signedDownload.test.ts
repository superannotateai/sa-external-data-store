jest.mock("../../middleware/authSaMiddleware", () => ({
    AuthSaMiddleware: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../../middleware/pathValidatorMiddleware", () => ({
    PathValidatorMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const mockReadAccessMap = jest.fn();
const mockGetFilesSignedUrl = jest.fn();
const mockValidateFilesSignature = jest.fn();
const mockGetFilesStream = jest.fn();

jest.mock("../../repository", () => ({
    __esModule: true,
    default: {
        readAccessMap: (...args: any[]) => mockReadAccessMap(...args),
        getFilesSignedUrl: (...args: any[]) => mockGetFilesSignedUrl(...args),
        validateFilesSignature: (...args: any[]) => mockValidateFilesSignature(...args),
        getFilesStream: (...args: any[]) => mockGetFilesStream(...args),
    },
}));

import storageRouter from "../storageRouter";

function getHandler(path: string) {
    const layer = storageRouter.stack.find(
        (l: any) => l.route && l.route.path === path && l.route.methods.get
    );
    if (!layer || !layer.route) throw new Error(`No GET ${path} handler found`);
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
        headersSent: false,
    };
    return res;
}

describe("storage routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET / (access map -> signed URLs)", () => {
        function createMockReq() {
            return {
                saScope: "1/2/3",
                saItemName: "invoice_42",
                protocol: "http",
                get: jest.fn().mockReturnValue("localhost:3005"),
            } as any;
        }

        it("should return 404 when the access map is missing", async () => {
            mockReadAccessMap.mockResolvedValue(null);
            const handler = getHandler("/");
            const res = createMockRes();

            await handler(createMockReq(), res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({ code: "NOT_FOUND_MANIFEST" });
            // Access maps are project-scoped (team/project), independent of folder.
            expect(mockReadAccessMap).toHaveBeenCalledWith("1/2", "invoice_42");
        });

        it("should sign only the files declared in the access map", async () => {
            mockReadAccessMap.mockResolvedValue({ label: "Invoice", files: ["a.pdf", "b.png"], metadata: { x: 1 } });
            mockGetFilesSignedUrl.mockImplementation((entry: string) => `http://localhost:3005/storage/fileSigned?path=${entry}`);
            const handler = getHandler("/");
            const res = createMockRes();

            await handler(createMockReq(), res, () => {});

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res._body);
            expect(body.label).toBe("Invoice");
            expect(Object.keys(body.files)).toEqual(["a.pdf", "b.png"]);
            expect(mockGetFilesSignedUrl).toHaveBeenCalledTimes(2);
        });

        it("should sign nested entries under the files root", async () => {
            mockReadAccessMap.mockResolvedValue({ label: "Batch", files: ["images/image_1.jpg"], metadata: {} });
            mockGetFilesSignedUrl.mockImplementation((entry: string) => `http://localhost:3005/storage/fileSigned?path=${encodeURIComponent(entry)}`);
            const handler = getHandler("/");
            const res = createMockRes();

            await handler(createMockReq(), res, () => {});

            expect(res.statusCode).toBe(200);
            expect(Object.keys(JSON.parse(res._body).files)).toEqual(["images/image_1.jpg"]);
            expect(mockGetFilesSignedUrl).toHaveBeenCalledWith("images/image_1.jpg", expect.any(String));
        });

        it.each([["../../etc/passwd"], ["images/../../etc/passwd"], ["/etc/passwd"], ["images//passwd"]])(
            "should reject unsafe access map entry %s",
            async (bad) => {
                mockReadAccessMap.mockResolvedValue({ files: [bad] });
                const handler = getHandler("/");
                const res = createMockRes();

                await handler(createMockReq(), res, () => {});

                expect(res.statusCode).toBe(500);
                expect(JSON.parse(res._body)).toMatchObject({ code: "INTERNAL_ERROR" });
                expect(mockGetFilesSignedUrl).not.toHaveBeenCalled();
            }
        );
    });

    describe("GET /fileSigned (redeem capability)", () => {
        function createMockReq(query: Record<string, string>) {
            return { query } as any;
        }

        it("should return 400 when params are missing", async () => {
            const handler = getHandler("/fileSigned");
            const res = createMockRes();

            await handler(createMockReq({ path: "a.pdf" }), res, () => {});

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res._body)).toMatchObject({ code: "MISSING_QUERY_PARAMETERS" });
        });

        it("should return 401 when the signature is invalid", async () => {
            mockValidateFilesSignature.mockResolvedValue(false);
            const handler = getHandler("/fileSigned");
            const res = createMockRes();

            await handler(createMockReq({ path: "a.pdf", expires: "999", signature: "bad" }), res, () => {});

            expect(res.statusCode).toBe(401);
            expect(JSON.parse(res._body)).toMatchObject({ code: "INVALID_SIGNATURE" });
            expect(mockGetFilesStream).not.toHaveBeenCalled();
        });

        it("should serve an inline-safe type inline with nosniff", async () => {
            mockValidateFilesSignature.mockResolvedValue(true);
            const stream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
            mockGetFilesStream.mockResolvedValue(stream);
            const handler = getHandler("/fileSigned");
            const res = createMockRes();

            await handler(createMockReq({ path: "a.pdf", expires: "999", signature: "ok" }), res, () => {});

            expect(res._headers["Content-Type"]).toBe("application/pdf");
            expect(res._headers["Content-Disposition"]).toBe("inline");
            expect(res._headers["X-Content-Type-Options"]).toBe("nosniff");
            expect(stream.pipe).toHaveBeenCalledWith(res);
        });

        it.each(["evil.svg", "page.html", "data.xml", "weird.exe"])(
            "should force download (octet-stream + attachment) for non-inline type %s",
            async (path) => {
                mockValidateFilesSignature.mockResolvedValue(true);
                const stream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
                mockGetFilesStream.mockResolvedValue(stream);
                const handler = getHandler("/fileSigned");
                const res = createMockRes();

                await handler(createMockReq({ path, expires: "999", signature: "ok" }), res, () => {});

                expect(res._headers["Content-Type"]).toBe("application/octet-stream");
                expect(res._headers["Content-Disposition"]).toBe("attachment");
                expect(res._headers["X-Content-Type-Options"]).toBe("nosniff");
                expect(stream.pipe).toHaveBeenCalledWith(res);
            }
        );

        it("should return 404 when the file is missing", async () => {
            mockValidateFilesSignature.mockResolvedValue(true);
            mockGetFilesStream.mockResolvedValue(null);
            const handler = getHandler("/fileSigned");
            const res = createMockRes();

            await handler(createMockReq({ path: "a.pdf", expires: "999", signature: "ok" }), res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({ code: "NOT_FOUND_FILE" });
        });
    });
});
