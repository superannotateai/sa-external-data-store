import { LocalRepository } from "../localRepository";
import { Config } from "../../utils/config";
import { AppError } from "../../types/errors";
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
            const path = "1/2/3/4/file.json";

            (fs.unlink as jest.Mock).mockResolvedValue(undefined);

            await localRepository.deleteData(path);

            expect(fs.unlink).toHaveBeenCalledTimes(1);
            expect(fs.unlink).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/file.json`);
        });

        it("should throw error if file deletion fails", async () => {
            const path = "1/2/3/4/file.json";
            const mockError = new Error("Permission denied");

            (fs.unlink as jest.Mock).mockRejectedValue(mockError);

            await expect(localRepository.deleteData(path)).rejects.toThrow("Permission denied");
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
            const path = "1/2/3/4/document.pdf";
            const mockStream = new Readable();

            (fs.access as jest.Mock).mockResolvedValue(undefined);
            (fsSync.createReadStream as jest.Mock).mockReturnValue(mockStream);

            const result = await localRepository.getDataStream(path);

            expect(fs.access).toHaveBeenCalledTimes(1);
            expect(fs.access).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(fsSync.createReadStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createReadStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(result).toBe(mockStream);
        });

        it("should return null when file does not exist", async () => {
            const path = "1/2/3/4/missing.pdf";
            const mockError: any = new Error("File not found");
            mockError.code = "ENOENT";

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            const result = await localRepository.getDataStream(path);

            expect(result).toBeNull();
            expect(fsSync.createReadStream).not.toHaveBeenCalled();
        });

        it("should throw error for non-ENOENT errors", async () => {
            const path = "1/2/3/4/file.txt";
            const mockError = new Error("Permission denied");

            (fs.access as jest.Mock).mockRejectedValue(mockError);

            await expect(localRepository.getDataStream(path)).rejects.toThrow("Permission denied");
        });
    });

    describe("saveDataStream", () => {
        it("should save stream with correct file path", async () => {
            const path = "1/2/3/4/document.pdf";
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "finish") {
                    setTimeout(() => callback(), 0);
                }
                return mockWriteStream;
            });

            const savePromise = localRepository.saveDataStream(path, mockStream);

            await savePromise;

            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/document.pdf`);
            expect(mockStream.pipe).toHaveBeenCalledWith(mockWriteStream);
        });

        it("should save stream without content length when not provided", async () => {
            const path = "1/2/3/4/file.txt";
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "finish") {
                    setTimeout(() => callback(), 0);
                }
                return mockWriteStream;
            });

            await localRepository.saveDataStream(path, mockStream);

            expect(fsSync.createWriteStream).toHaveBeenCalledTimes(1);
            expect(fsSync.createWriteStream).toHaveBeenCalledWith(`${mockBasePath}/items/1/2/3/4/file.txt`);
        });

        it("should reject when write stream has error", async () => {
            const path = "1/2/3/4/file.txt";
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };
            const mockError = new Error("Write failed");

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "error") {
                    setTimeout(() => callback(mockError), 0);
                }
                return mockWriteStream;
            });

            await expect(localRepository.saveDataStream(path, mockStream)).rejects.toThrow("Write failed");
        });

        it("should reject when input stream has error", async () => {
            const path = "1/2/3/4/file.txt";
            const mockStream: any = {
                pipe: jest.fn(),
                on: jest.fn(),
            };
            const mockWriteStream = {
                on: jest.fn(),
            };
            const mockError = new Error("Read failed");

            mockStream.pipe.mockReturnValue(mockWriteStream);

            (fsSync.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            mockWriteStream.on.mockImplementation(() => mockWriteStream);
            mockStream.on.mockImplementation((event: string, callback: Function) => {
                if (event === "error") {
                    setTimeout(() => callback(mockError), 0);
                }
                return mockStream;
            });

            await expect(localRepository.saveDataStream(path, mockStream)).rejects.toThrow("Read failed");
        });
    });

    describe("getSignedUrl", () => {
        beforeEach(() => {
            jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it("should return signed URL with path, expires, and signature", async () => {
            const path = "1/2/3/4/document.pdf";

            (Config as any).signUrlExpirationTimeHr = jest.fn().mockReturnValue(24);
            (Config as any).localSignSecretKey = jest.fn().mockReturnValue("secret");

            const result = await localRepository.getSignedUrl(path, "http://localhost:3005");

            expect(result).toMatch(/^http:\/\/localhost:3005\/storage\/fileSigned\?path=.*&expires=\d+&signature=[a-f0-9]+$/);
            expect(result).toContain("path=1%2F2%2F3%2F4%2Fdocument.pdf");
        });

        it("should produce valid signature for same inputs", async () => {
            (Config as any).signUrlExpirationTimeHr = jest.fn().mockReturnValue(1);
            (Config as any).localSignSecretKey = jest.fn().mockReturnValue("fixed-secret");

            const result1 = await localRepository.getSignedUrl("1/2/3/4/file.txt", "http://localhost:3005");
            const result2 = await localRepository.getSignedUrl("1/2/3/4/file.txt", "http://localhost:3005");

            const sig1 = result1.match(/signature=([a-f0-9]+)/)?.[1];
            const sig2 = result2.match(/signature=([a-f0-9]+)/)?.[1];
            expect(sig1).toBeDefined();
            expect(sig2).toBeDefined();
            expect(sig1).toBe(sig2);
        });

        it("should throw when host is not provided", async () => {
            await expect(localRepository.getSignedUrl("1/2/3/4/file.txt")).rejects.toThrow("Host is required");
        });

        it("should reject path traversal when signing", async () => {
            await expect(
                localRepository.getSignedUrl("../../../../../../etc/passwd", "http://localhost:3005")
            ).rejects.toThrow(AppError);
        });
    });

    describe("path traversal protection", () => {
        it("should reject traversal in getDataStream", async () => {
            await expect(localRepository.getDataStream("../../../../../../etc/passwd")).rejects.toThrow(AppError);
        });

        it("should return false from validateSignature for traversal paths", async () => {
            (Config as any).localSignSecretKey = jest.fn().mockReturnValue("secret");

            const valid = await localRepository.validateSignature(
                "../../../../../../etc/passwd",
                String(Date.now() + 60_000),
                "00".repeat(32)
            );

            expect(valid).toBe(false);
        });
    });
});
