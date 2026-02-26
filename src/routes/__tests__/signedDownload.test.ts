jest.mock("../../middleware/authSaMiddleware", () => ({
    AuthSaMiddleware: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../../middleware/pathValidatorMiddleware", () => ({
    PathValidatorMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const mockGetSignedUrl = jest.fn();
const mockIsFileExists = jest.fn();

jest.mock("../../repository", () => ({
    __esModule: true,
    default: {
        getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
        isFileExists: (...args: any[]) => mockIsFileExists(...args),
    },
}));

import storageRouter from "../storageRouter";

function getHandler() {
    const layer = storageRouter.stack.find(
        (l: any) => l.route && l.route.path === "/signedUrl" && l.route.methods.get
    );
    if (!layer || !layer.route) throw new Error("No GET /signedUrl handler found");
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
    };
    return res;
}

function createMockReq(headers: Record<string, string> = {}, saFilePath?: string) {
    const req: any = {
        headers,
        protocol: "http",
        get: jest.fn().mockReturnValue("localhost:3005"),
    };
    if (saFilePath !== undefined) {
        req.saFilePath = saFilePath;
    }
    return req;
}

describe("storage signedUrl route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /signedUrl", () => {
        it("should return 404 when file does not exist", async () => {
            mockIsFileExists.mockResolvedValue(false);
            const handler = getHandler();
            const req = createMockReq({}, "1/2/3/4/document.pdf");
            const res = createMockRes();

            await handler(req as any, res as any, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "File does not exist",
            });
            expect(mockGetSignedUrl).not.toHaveBeenCalled();
        });

        it("should return 200 with signedUrl when found", async () => {
            const signedUrl = "https://bucket.s3.amazonaws.com/items/1/2/3/4/document.pdf?X-Amz-...";
            mockIsFileExists.mockResolvedValue(true);
            mockGetSignedUrl.mockResolvedValue(signedUrl);
            const handler = getHandler();
            const req = createMockReq({}, "1/2/3/4/document.pdf");
            const res = createMockRes();

            await handler(req as any, res as any, () => {});

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res._body)).toMatchObject({ signedUrl });
            expect(mockGetSignedUrl).toHaveBeenCalledWith("1/2/3/4/document.pdf", "http://localhost:3005");
        });
    });
});
