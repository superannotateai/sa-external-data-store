const mockIsFileExists = jest.fn();
const mockGetDataStream = jest.fn();

jest.mock("../../middleware/authSaMiddleware", () => ({
    AuthSaMiddleware: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../../middleware/pathValidatorMiddleware", () => ({
    PathValidatorMiddleware: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../../repository", () => ({
    __esModule: true,
    default: {
        isFileExists: (...args: any[]) => mockIsFileExists(...args),
        getDataStream: (...args: any[]) => mockGetDataStream(...args),
    },
}));

import storageRouter from "../storageRouter";

function getHandler() {
    const layer = storageRouter.stack.find(
        (l: any) => l.route && l.route.path === "/file" && l.route.methods.get
    );
    if (!layer || !layer.route) throw new Error("No GET /file handler found");
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
        setHeader(key: string, value: string) {
            this._headers[key] = value;
            return this;
        },
        headersSent: false,
    };
    return res;
}

function createMockReq(path?: string) {
    const req: any = {
        saFilePath: path,
    };
    return req;
}

describe("storage file route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /file", () => {
        it("should return 404 when file does not exist", async () => {
            mockIsFileExists.mockResolvedValue(false);
            const handler = getHandler();
            const req = createMockReq("items/1/2/file.pdf");
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "File does not exist",
            });
            expect(mockGetDataStream).not.toHaveBeenCalled();
        });

        it("should return 404 when stream is null", async () => {
            mockIsFileExists.mockResolvedValue(true);
            mockGetDataStream.mockResolvedValue(null);
            const handler = getHandler();
            const req = createMockReq("items/1/2/file.pdf");
            const res = createMockRes();

            await handler(req, res, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "File does not exist",
            });
        });

        it("should set content type and pipe stream when file exists", async () => {
            const mockStream = {
                on: jest.fn().mockReturnThis(),
                pipe: jest.fn(),
            };
            mockIsFileExists.mockResolvedValue(true);
            mockGetDataStream.mockResolvedValue(mockStream);
            const res = createMockRes();
            const handler = getHandler();
            const req = createMockReq("items/1/2/file.pdf");

            await handler(req, res, () => {});

            expect(res._headers["Content-Type"]).toBe("application/pdf");
            expect(mockStream.pipe).toHaveBeenCalledWith(res);
        });
    });
});
