import { S3Sdk } from "../s3Sdk";
import { Readable } from "stream";
import { Upload } from "@aws-sdk/lib-storage";

jest.mock("../config", () => ({
    Config: {
        s3BucketName: jest.fn(() => "test-bucket"),
        s3Region: jest.fn(() => "us-east-1"),
        s3AccessKeyId: jest.fn(() => "test-key"),
        s3SecretAccessKey: jest.fn(() => "test-secret"),
    },
}));

const mockDone = jest.fn();
const mockAbort = jest.fn();

jest.mock("@aws-sdk/lib-storage", () => ({
    Upload: jest.fn().mockImplementation(() => ({
        done: mockDone,
        abort: mockAbort,
    })),
}));

describe("S3Sdk", () => {
    let s3Sdk: S3Sdk;

    beforeEach(() => {
        jest.clearAllMocks();
        s3Sdk = new S3Sdk();
    });

    describe("uploadStream", () => {
        const partSize = 5 * 1024 * 1024; // 5 MB

        it("should use Upload from @aws-sdk/lib-storage with correct params", async () => {
            const key = "items/1/2/3/4.txt";
            const stream = new Readable();
            const contentType = "text/plain";
            const contentLength = 1024;

            mockDone.mockResolvedValue(undefined);

            await s3Sdk.uploadStream(key, stream, contentType, contentLength);

            expect(Upload).toHaveBeenCalledTimes(1);
            expect(Upload).toHaveBeenCalledWith({
                client: expect.anything(),
                params: {
                    Bucket: "test-bucket",
                    Key: key,
                    Body: stream,
                    ContentType: contentType,
                    ContentLength: contentLength,
                },
                partSize,
                queueSize: 4,
                leavePartsOnError: false,
            });
            expect(mockDone).toHaveBeenCalledTimes(1);
        });

        it("should call done() without contentLength when not provided", async () => {
            const key = "path/to/file";
            const stream = new Readable();

            mockDone.mockResolvedValue(undefined);

            await s3Sdk.uploadStream(key, stream);

            expect(Upload).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: expect.objectContaining({
                        Key: key,
                        Body: stream,
                        ContentLength: undefined,
                    }),
                })
            );
            expect(mockDone).toHaveBeenCalledTimes(1);
        });

        it("should abort multipart upload and rethrow when done() fails", async () => {
            const key = "path/to/file";
            const stream = new Readable();
            const uploadError = new Error("Upload failed");

            mockDone.mockRejectedValue(uploadError);
            mockAbort.mockResolvedValue(undefined);

            await expect(s3Sdk.uploadStream(key, stream)).rejects.toThrow("Upload failed");

            expect(mockDone).toHaveBeenCalledTimes(1);
            expect(mockAbort).toHaveBeenCalledTimes(1);
        });

        it("should rethrow original error when abort() also fails", async () => {
            const key = "path/to/file";
            const stream = new Readable();
            const uploadError = new Error("Upload failed");

            mockDone.mockRejectedValue(uploadError);
            mockAbort.mockRejectedValue(new Error("Abort failed"));

            const consoleSpy = jest.spyOn(console, "error").mockImplementation();

            await expect(s3Sdk.uploadStream(key, stream)).rejects.toThrow("Upload failed");

            expect(mockAbort).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith("Failed to abort multipart upload:", expect.any(Error));

            consoleSpy.mockRestore();
        });
    });
});
