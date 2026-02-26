import { Readable } from "stream";

jest.mock("../s3Repository");
jest.mock("../../utils/config", () => ({
    Config: {
        dataStore: jest.fn(() => "S3"),
        s3BucketName: jest.fn(() => "test-bucket"),
        s3AccessKeyId: jest.fn(() => "test-key"),
        s3SecretAccessKey: jest.fn(() => "test-secret"),
        s3Region: jest.fn(() => "us-east-1"),
    },
}));

import RepositoryModule from "../index";
import { S3Repository } from "../s3Repository";
import { Config } from "../../utils/config";

const Repository = RepositoryModule as any;

describe("Repository", () => {
    let mockS3Repository: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockS3Repository = {
            getDataStream: jest.fn(),
            saveDataStream: jest.fn(),
            getSignedUrl: jest.fn(),
            getFilePath: jest.fn(),
            isFileExists: jest.fn(),
        };
        (S3Repository as jest.MockedClass<typeof S3Repository>).mockImplementation(() => mockS3Repository);
        (Config.dataStore as jest.Mock).mockReturnValue("S3");
        Repository.repository = mockS3Repository;
    });

    describe("getDataStream", () => {
        it("should return stream when data exists", async () => {
            const path = "1/2/3/4/document.pdf";
            const mockStream = new Readable();

            mockS3Repository.getDataStream.mockResolvedValue(mockStream);

            const result = await Repository.getDataStream(path);

            expect(mockS3Repository.getDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.getDataStream).toHaveBeenCalledWith(path);
            expect(result).toBe(mockStream);
        });

        it("should return null when repository is null", async () => {
            Repository.repository = null;

            const result = await Repository.getDataStream("1/2/3/4/file.txt");

            expect(result).toBeNull();
        });

        it("should return null when repository returns null", async () => {
            mockS3Repository.getDataStream.mockResolvedValue(null);

            const result = await Repository.getDataStream("1/2/3/4/file.txt");

            expect(result).toBeNull();
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct parameters", async () => {
            const path = "1/2/3/4/document.pdf";
            const mockStream = new Readable();

            mockS3Repository.saveDataStream.mockResolvedValue(undefined);

            await Repository.saveDataStream(path, mockStream);

            expect(mockS3Repository.saveDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.saveDataStream).toHaveBeenCalledWith(path, mockStream);
        });

        it("should save stream without content length when not provided", async () => {
            const path = "1/2/3/4/file.txt";
            const mockStream = new Readable();

            mockS3Repository.saveDataStream.mockResolvedValue(undefined);

            await Repository.saveDataStream(path, mockStream);

            expect(mockS3Repository.saveDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.saveDataStream).toHaveBeenCalledWith(path, mockStream);
        });
    });

    describe("getSignedUrl", () => {
        it("should return signed URL when repository returns one", async () => {
            const path = "1/2/3/4/document.pdf";
            const expectedUrl = "https://bucket.s3.region.amazonaws.com/items/1/2/3/4/document.pdf?X-Amz-...";

            mockS3Repository.getSignedUrl.mockResolvedValue(expectedUrl);

            const result = await Repository.getSignedUrl(path);

            expect(mockS3Repository.getSignedUrl).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.getSignedUrl).toHaveBeenCalledWith(path, undefined);
            expect(result).toBe(expectedUrl);
        });

        it("should return empty string when repository is null", async () => {
            Repository.repository = null;

            const result = await Repository.getSignedUrl("1/2/3/4/file.txt");

            expect(result).toBe("");
        });

        it("should return empty string when repository returns empty string", async () => {
            mockS3Repository.getSignedUrl.mockResolvedValue("");

            const result = await Repository.getSignedUrl("1/2/3/4/missing.txt");

            expect(result).toBe("");
        });
    });
});
