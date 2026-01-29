jest.mock("../../middleware/auth", () => ({
    saItemMiddleware: (req: any, res: any, next: any) => next(),
}));

const mockGetSignedUrl = jest.fn();

jest.mock("../../repository", () => ({
    __esModule: true,
    default: {
        getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
    },
}));

import signedDownloadRouter from "../signedDownload";

const validHeaders = {
    "sa-item-id": "4",
    "sa-team-id": "1",
    "sa-project-id": "2",
    "sa-folder-id": "3",
    "sa-file-name": "document.pdf",
};

function getHandler() {
    const layer = signedDownloadRouter.stack.find(
        (l: any) => l.route && l.route.path === "/" && l.route.methods.get
    );
    if (!layer || !layer.route) throw new Error("No GET / handler found");
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

function createMockReq(headers: Record<string, string> = {}) {
    return { headers };
}

describe("signedDownload routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /dataUrl", () => {
        it("should return 400 when required headers are missing", async () => {
            const handler = getHandler();
            const req = createMockReq({ "sa-team-id": "1" });
            const res = createMockRes();

            await handler(req as any, res as any, () => {});

            expect(res.statusCode).toBe(400);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Bad Request",
                message: "Invalid or missing required headers",
            });
            expect(mockGetSignedUrl).not.toHaveBeenCalled();
        });

        it("should return 404 when signed URL not found", async () => {
            mockGetSignedUrl.mockResolvedValue("");
            const handler = getHandler();
            const req = createMockReq(validHeaders);
            const res = createMockRes();

            await handler(req as any, res as any, () => {});

            expect(res.statusCode).toBe(404);
            expect(JSON.parse(res._body)).toMatchObject({
                error: "Not Found",
                message: "Signed URL not found",
            });
            expect(mockGetSignedUrl).toHaveBeenCalledWith(1, 2, 3, 4, "document.pdf");
        });

        it("should return 200 with signedUrl when found", async () => {
            const signedUrl = "https://bucket.s3.amazonaws.com/items/1/2/3/4/document.pdf?X-Amz-...";
            mockGetSignedUrl.mockResolvedValue(signedUrl);
            const handler = getHandler();
            const req = createMockReq(validHeaders);
            const res = createMockRes();

            await handler(req as any, res as any, () => {});

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res._body)).toMatchObject({ signedUrl });
            expect(JSON.parse(res._body).timestamp).toBeDefined();
            expect(mockGetSignedUrl).toHaveBeenCalledWith(1, 2, 3, 4, "document.pdf");
        });
    });
});
