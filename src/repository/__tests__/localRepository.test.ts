import { LocalRepository } from "../localRepository";
import { Config } from "../../utils/config";
import { Readable } from "stream";
import * as fs from "fs/promises";
import * as fsSync from "fs";

// Mock Config
jest.mock("../../utils/config");

// Mock fs/promises
jest.mock("fs/promises");

// Mock fs (for streams)
jest.mock("fs");

describe("LocalRepository", () => {
    let localRepository: LocalRepository;
    const mockBasePath = "/mock/storage/path";

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Mock Config.localStoragePath to return a test path
        (Config.localStoragePath as jest.Mock).mockReturnValue(mockBasePath);

        localRepository = new LocalRepository();
    });

    describe("deleteData", () => {
        it("should delete data with correct file path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;

            (fs.unlink as jest.Mock).mockResolvedValue(undefined);

            await localRepository.deleteData(teamId, projectId, folderId, itemId);

            expect(fs.unlink).toHaveBeenCalledTimes(1);
            expect(fs.unlink).toHaveBeenCalledWith(
                `${mockBasePath}/items/1/2/3/4.json`
            );
        });

        it("should throw error if file deletion fails", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockError = new Error("Permission denied");

            (fs.unlink as jest.Mock).mockRejectedValue(mockError);

            await expect(
                localRepository.deleteData(teamId, projectId, folderId, itemId)
            ).rejects.toThrow("Permission denied");
        });
    });

    describe("listData", () => {
        it("should list data with correct directory path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const mockFiles = ["4.txt", "5.txt", "6.json"];

            (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);

            const result = await localRepository.listData(teamId, projectId, folderId);

            expect(fs.readdir).toHaveBeenCalledTimes(1);
            expect(fs.readdir).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3`);
            expect(result).toEqual([
                "items/1/2/3/4.txt",
                "items/1/2/3/5.txt",
                "items/1/2/3/6.json",
            ]);
        });

        it("should return empty array when directory does not exist", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const mockError: any = new Error("Directory not found");
            mockError.code = "ENOENT";

            (fs.readdir as jest.Mock).mockRejectedValue(mockError);

            const result = await localRepository.listData(teamId, projectId, folderId);

            expect(result).toEqual([]);
        });

        it("should throw error for non-ENOENT errors", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const mockError = new Error("Permission denied");

            (fs.readdir as jest.Mock).mockRejectedValue(mockError);

            await expect(
                localRepository.listData(teamId, projectId, folderId)
            ).rejects.toThrow("Permission denied");
        });
    });

    describe("getDataStream", () => {
        it("should return stream when file exists", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream = new Readable();

            (fs.access as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createReadStream as jest.Mock).mockReturnValue(mockStream);

            const result = await localRepository.getDataStream(teamId, projectId, folderId, itemId);

            expect(fs.access).toHaveBeenCalledTimes(1);
            expect(fs.access).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4.txt`);
            expect(fsSync.createReadStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createReadStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4.txt`);
            expect(result).toBe(mockStream);
        });

        it("should return null when file does not exist", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockError: any = new Error("File not found");
            mockError.code = "ENOENT";

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            const result = await localRepository.getDataStream(teamId, projectId, folderId, itemId);

            expect(result).toBeNull();
            expect(fsSync.createReadStream).not.toHaveBeenCalled();
        });

        it("should throw error for non-ENOENT errors", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockError = new Error("Permission denied");

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            await expect(
                localRepository.getDataStream(teamId, projectId, folderId, itemId)
            ).rejects.toThrow("Permission denied");
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct file path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };

            // Mock the pipe method
            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            // Simulate successful write
            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "finish") {
                    setTimeout(() => callback(), 0);
                }
                return mockWriteStream;
            });

            const savePromise = localRepository.saveDataStream(teamId, projectId, folderId, itemId, mockStream);

            await savePromise;

            expect(fs.mkdir).toHaveBeenCalledTimes(1);
            expect(fs.mkdir).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3`, { recursive: true });
            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4.txt`);
            expect(mockStream.pipe).toHaveBeenCalledWith(mockWriteStream);
        });

        it("should save stream without content length when not provided", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "finish") {
                    setTimeout(() => callback(), 0);
                }
                return mockWriteStream;
            });

            await localRepository.saveDataStream(teamId, projectId, folderId, itemId, mockStream);

            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4.txt`);
        });

        it("should reject when write stream has error", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };
            const mockError = new Error("Write failed");

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "error") {
                    setTimeout(() => callback(mockError), 0);
                }
                return mockWriteStream;
            });

            await expect(
                localRepository.saveDataStream(teamId, projectId, folderId, itemId, mockStream)
            ).rejects.toThrow("Write failed");
        });

        it("should reject when input stream has error", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };
            const mockError = new Error("Read failed");

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation(() => mockWriteStream);
            mockStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "error") {
                    setTimeout(() => callback(mockError), 0);
                }
                return mockStream;
            });

            await expect(
                localRepository.saveDataStream(teamId, projectId, folderId, itemId, mockStream)
            ).rejects.toThrow("Read failed");
        });
    });
});
