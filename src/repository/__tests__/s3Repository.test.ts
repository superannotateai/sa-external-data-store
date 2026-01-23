import { S3Repository } from "../s3Repository";
import { S3Sdk } from "../../utils/s3Sdk";
import { Readable } from "stream";
import { GetObjectCommandOutput } from "@aws-sdk/client-s3";

// Mock S3Sdk
jest.mock("../../utils/s3Sdk");

describe("S3Repository", () => {
    let s3Repository: S3Repository;
    let mockS3Sdk: jest.Mocked<S3Sdk>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create a mock instance of S3Sdk
        mockS3Sdk = {
            deleteFile: jest.fn(),
            listObjects: jest.fn(),
            downloadFile: jest.fn(),
            uploadStream: jest.fn(),
        } as any;

        // Mock the S3Sdk constructor to return our mock
        (S3Sdk as jest.MockedClass<typeof S3Sdk>).mockImplementation(() => {
            return mockS3Sdk;
        });

        s3Repository = new S3Repository();
    });

    describe("deleteData", () => {
        it("should delete data with correct key path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;

            await s3Repository.deleteData(teamId, projectId, folderId, itemId);

            expect(mockS3Sdk.deleteFile).toHaveBeenCalledTimes(1);
            expect(mockS3Sdk.deleteFile).toHaveBeenCalledWith(
                "items/1/2/3/4.json"
            );
        });
    });

    describe("listData", () => {
        it("should list data with correct prefix path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const expectedKeys = ["items/1/2/3/file1.txt", "items/1/2/3/file2.txt"];

            mockS3Sdk.listObjects.mockResolvedValue(expectedKeys);

            const result = await s3Repository.listData(teamId, projectId, folderId);

            expect(mockS3Sdk.listObjects).toHaveBeenCalledTimes(1);
            expect(mockS3Sdk.listObjects).toHaveBeenCalledWith("items/1/2/3");
            expect(result).toEqual(expectedKeys);
        });

        it("should return empty array when no objects found", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;

            mockS3Sdk.listObjects.mockResolvedValue([]);

            const result = await s3Repository.listData(teamId, projectId, folderId);

            expect(result).toEqual([]);
        });
    });

    describe("getDataStream", () => {
        it("should return stream when file exists", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();

            const mockResponse: Partial<GetObjectCommandOutput> = {
                Body: mockStream as any,
            };

            mockS3Sdk.downloadFile.mockResolvedValue(mockResponse as GetObjectCommandOutput);

            const result = await s3Repository.getDataStream(teamId, projectId, folderId, itemId);

            expect(mockS3Sdk.downloadFile).toHaveBeenCalledTimes(1);
            expect(mockS3Sdk.downloadFile).toHaveBeenCalledWith("items/1/2/3/4.txt");
            expect(result).toBe(mockStream);
        });

        it("should return null when file does not exist", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;

            mockS3Sdk.downloadFile.mockResolvedValue(null);

            const result = await s3Repository.getDataStream(teamId, projectId, folderId, itemId);

            expect(result).toBeNull();
        });

        it("should return null when response body is undefined", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;

            const mockResponse: Partial<GetObjectCommandOutput> = {
                Body: undefined,
            };

            mockS3Sdk.downloadFile.mockResolvedValue(mockResponse as GetObjectCommandOutput);

            const result = await s3Repository.getDataStream(teamId, projectId, folderId, itemId);

            expect(result).toBeNull();
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct key path and content type", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();
            const contentLength = 1024;

            await s3Repository.saveDataStream(teamId, projectId, folderId, itemId, mockStream, contentLength);

            expect(mockS3Sdk.uploadStream).toHaveBeenCalledTimes(1);
            expect(mockS3Sdk.uploadStream).toHaveBeenCalledWith(
                "items/1/2/3/4.txt",
                mockStream,
                "text/plain",
                contentLength
            );
        });

        it("should save stream without content length when not provided", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();

            await s3Repository.saveDataStream(teamId, projectId, folderId, itemId, mockStream);

            expect(mockS3Sdk.uploadStream).toHaveBeenCalledTimes(1);
            expect(mockS3Sdk.uploadStream).toHaveBeenCalledWith(
                "items/1/2/3/4.txt",
                mockStream,
                "text/plain",
                undefined
            );
        });
    });
});

