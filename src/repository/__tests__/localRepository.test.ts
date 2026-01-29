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
                `${mockBasePath}/items/1/2/3/4/json`
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
            const mockSubdirs = ["4", "5", "6"];

            (fs.readdir as jest.Mock).mockResolvedValue(mockSubdirs);

            const result = await localRepository.listData(teamId, projectId, folderId);

            expect(fs.readdir).toHaveBeenCalledTimes(1);
            expect(fs.readdir).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3`);
            expect(result).toEqual([
                "items/1/2/3/4",
                "items/1/2/3/5",
                "items/1/2/3/6",
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
            const fileName = "document.pdf";
            const mockStream = new Readable();

            (fs.access as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createReadStream as jest.Mock).mockReturnValue(mockStream);

            const result = await localRepository.getDataStream(teamId, projectId, folderId, itemId, fileName);

            expect(fs.access).toHaveBeenCalledTimes(1);
            expect(fs.access).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(fsSync.createReadStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createReadStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(result).toBe(mockStream);
        });

        it("should return null when file does not exist", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "missing.pdf";
            const mockError: any = new Error("File not found");
            mockError.code = "ENOENT";

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            const result = await localRepository.getDataStream(teamId, projectId, folderId, itemId, fileName);

            expect(result).toBeNull();
            expect(fsSync.createReadStream).not.toHaveBeenCalled();
        });

        it("should throw error for non-ENOENT errors", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "file.txt";
            const mockError = new Error("Permission denied");

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            await expect(
                localRepository.getDataStream(teamId, projectId, folderId, itemId, fileName)
            ).rejects.toThrow("Permission denied");
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct file path", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "document.pdf";
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

            const savePromise = localRepository.saveDataStream(teamId, projectId, folderId, itemId, fileName, mockStream);

            await savePromise;

            expect(fs.mkdir).toHaveBeenCalledTimes(1);
            expect(fs.mkdir).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4`, { recursive: true });
            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(mockStream.pipe).toHaveBeenCalledWith(mockWriteStream);
        });

        it("should save stream without content length when not provided", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "file.txt";
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

            await localRepository.saveDataStream(teamId, projectId, folderId, itemId, fileName, mockStream);

            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/file.txt`);
        });

        it("should reject when write stream has error", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "file.txt";
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
                localRepository.saveDataStream(teamId, projectId, folderId, itemId, fileName, mockStream)
            ).rejects.toThrow("Write failed");
        });

        it("should reject when input stream has error", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "file.txt";
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
                localRepository.saveDataStream(teamId, projectId, folderId, itemId, fileName, mockStream)
            ).rejects.toThrow("Read failed");
        });
    });

    describe("getSignedUrl", () => {
        it("should return signed URL with path, expires, and signature", async () => {
            const teamId = 1;
            const projectId = 2;
            const folderId = 3;
            const itemId = 4;
            const fileName = "document.pdf";

            (Config as any).signUrlExpirationTimeHr = jest.fn().mockReturnValue(24);
            (Config as any).localSignSecretKey = jest.fn().mockReturnValue("secret");

            const result = await localRepository.getSignedUrl(teamId, projectId, folderId, itemId, fileName);

            expect(result).toMatch(/^\/file\/document\.pdf\?path=items%2F1%2F2%2F3%2F4%2Fdocument\.pdf&expires=\d+&signature=[a-f0-9]+$/);
        });

        it("should produce valid signature for same inputs", async () => {
            (Config as any).signUrlExpirationTimeHr = jest.fn().mockReturnValue(1);
            (Config as any).localSignSecretKey = jest.fn().mockReturnValue("fixed-secret");

            const result1 = await localRepository.getSignedUrl(1, 2, 3, 4, "file.txt");
            const result2 = await localRepository.getSignedUrl(1, 2, 3, 4, "file.txt");

            const sig1 = result1.match(/signature=([a-f0-9]+)/)?.[1];
            const sig2 = result2.match(/signature=([a-f0-9]+)/)?.[1];
            expect(sig1).toBeDefined();
            expect(sig2).toBeDefined();
            expect(sig1).toBe(sig2);
        });
    });
});
