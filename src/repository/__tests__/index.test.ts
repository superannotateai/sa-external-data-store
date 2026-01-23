import { Readable } from "stream";

// Mock dependencies BEFORE importing the module
jest.mock("../s3Repository");
jest.mock("../../utils/config", () => ({
    Config: {
        dataStore: jest.fn(() => "S3"),
        s3BucketName: jest.fn(() => "test-bucket"),
        s3AccessKeyId: jest.fn(() => "test-key"),
        s3SecretAccessKey: jest.fn(() => "test-secret"),
        s3Region: jest.fn(() => "us-east-1"),
        SaAuthHost: jest.fn(() => "https://test.com"),
    },
}));

// Import after mocks are set up
import RepositoryModule from "../index";
import { S3Repository } from "../s3Repository";
import { Config } from "../../utils/config";

// Get the Repository instance from the module
const Repository = RepositoryModule as any;

describe("Repository", () => {
    let mockS3Repository: jest.Mocked<S3Repository>;

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create a mock instance of S3Repository
        mockS3Repository = {
            deleteData: jest.fn(),
            listData: jest.fn(),
            getDataStream: jest.fn(),
            saveDataStream: jest.fn(),
        } as any;

        // Mock the S3Repository constructor to return our mock
        (S3Repository as jest.MockedClass<typeof S3Repository>).mockImplementation(() => {
            return mockS3Repository;
        });

        // Ensure Config.dataStore returns "S3"
        (Config.dataStore as jest.Mock).mockReturnValue("S3");

        // Replace the repository instance in the singleton with our mock
        Repository.repository = mockS3Repository;
    });

    describe("deleteData", () => {
        it("should call repository deleteData with correct parameters", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;

            mockS3Repository.deleteData.mockResolvedValue(undefined);

            await Repository.deleteData(teamId, projectId, folderId, itemId);

            expect(mockS3Repository.deleteData).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.deleteData).toHaveBeenCalledWith(
                teamId,
                projectId,
                folderId,
                itemId
            );
        });
    });

    describe("listData", () => {
        it("should return list of data keys", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const expectedKeys = ["items/1/2/3/file1.txt", "items/1/2/3/file2.txt"];

            mockS3Repository.listData.mockResolvedValue(expectedKeys);

            const result = await Repository.listData(teamId, projectId, folderId);

            expect(mockS3Repository.listData).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.listData).toHaveBeenCalledWith(teamId, projectId, folderId);
            expect(result).toEqual(expectedKeys);
        });

        it("should return empty array when repository is null", async () => {
            // Set repository to null for this test
            const originalRepository = Repository.repository;
            Repository.repository = null;

            const result = await Repository.listData(1, 2, 3);

            expect(result).toEqual([]);

            // Restore repository
            Repository.repository = originalRepository;
        });
    });

    describe("getDataStream", () => {
        it("should return stream when data exists", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();

            mockS3Repository.getDataStream.mockResolvedValue(mockStream as any);

            const result = await Repository.getDataStream(teamId, projectId, folderId, itemId);

            expect(mockS3Repository.getDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.getDataStream).toHaveBeenCalledWith(
                teamId,
                projectId,
                folderId,
                itemId
            );
            expect(result).toBe(mockStream);
        });

        it("should return null when repository is null", async () => {
            // Set repository to null for this test
            const originalRepository = Repository.repository;
            Repository.repository = null;

            const result = await Repository.getDataStream(1, 2, 3, 4);

            expect(result).toBeNull();

            // Restore repository
            Repository.repository = originalRepository;
        });

        it("should return null when repository returns null", async () => {
            mockS3Repository.getDataStream.mockResolvedValue(null);

            const result = await Repository.getDataStream(1, 2, 3, 4);

            expect(result).toBeNull();
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct parameters", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();
            const contentLength = 1024;

            mockS3Repository.saveDataStream.mockResolvedValue(undefined);

            await Repository.saveDataStream(teamId, projectId, folderId, itemId, mockStream, contentLength);

            expect(mockS3Repository.saveDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.saveDataStream).toHaveBeenCalledWith(
                teamId,
                projectId,
                folderId,
                itemId,
                mockStream,
                contentLength
            );
        });

        it("should save stream without content length when not provided", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();

            mockS3Repository.saveDataStream.mockResolvedValue(undefined);

            await Repository.saveDataStream(teamId, projectId, folderId, itemId, mockStream);

            expect(mockS3Repository.saveDataStream).toHaveBeenCalledTimes(1);
            expect(mockS3Repository.saveDataStream).toHaveBeenCalledWith(
                teamId,
                projectId,
                folderId,
                itemId,
                mockStream,
                undefined
            );
        });
    });
});
