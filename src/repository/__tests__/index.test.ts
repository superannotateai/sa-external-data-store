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
            getFilePath: jest.fn(),
            isFileExists: jest.fn(),
            readManifest: jest.fn(),
            filesExists: jest.fn(),
            getFilesStream: jest.fn(),
            getFilesSignedUrl: jest.fn(),
            validateFilesSignature: jest.fn(),
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

    describe("readManifest", () => {
        it("should delegate to the backend repository", async () => {
            const manifest = { label: "doc", files: ["a.pdf"], metadata: null };
            mockS3Repository.readManifest.mockResolvedValue(manifest);

            const result = await Repository.readManifest("1/2/3/invoice.json");

            expect(mockS3Repository.readManifest).toHaveBeenCalledWith("1/2/3/invoice.json");
            expect(result).toBe(manifest);
        });

        it("should return null when repository is null", async () => {
            Repository.repository = null;

            const result = await Repository.readManifest("1/2/3/invoice.json");

            expect(result).toBeNull();
        });
    });

    describe("getFilesSignedUrl", () => {
        it("should delegate to the backend repository", () => {
            const expectedUrl = "http://localhost:3005/storage/fileSigned?path=a.pdf&expires=1&signature=ab";
            mockS3Repository.getFilesSignedUrl.mockReturnValue(expectedUrl);

            const result = Repository.getFilesSignedUrl("a.pdf", "http://localhost:3005");

            expect(mockS3Repository.getFilesSignedUrl).toHaveBeenCalledWith("a.pdf", "http://localhost:3005");
            expect(result).toBe(expectedUrl);
        });

        it("should return empty string when repository is null", () => {
            Repository.repository = null;

            const result = Repository.getFilesSignedUrl("a.pdf", "http://localhost:3005");

            expect(result).toBe("");
        });
    });

    describe("validateFilesSignature", () => {
        it("should delegate to the backend repository", async () => {
            mockS3Repository.validateFilesSignature.mockResolvedValue(true);

            const result = await Repository.validateFilesSignature("a.pdf", "123", "sig");

            expect(mockS3Repository.validateFilesSignature).toHaveBeenCalledWith("a.pdf", "123", "sig");
            expect(result).toBe(true);
        });

        it("should return false when repository is null", async () => {
            Repository.repository = null;

            const result = await Repository.validateFilesSignature("a.pdf", "123", "sig");

            expect(result).toBe(false);
        });
    });
});
