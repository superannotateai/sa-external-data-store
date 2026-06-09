import { assertSafeRelativeItemsPath, isSafeRelativeSubpath, isSafeSegment, isUnsafeRelativePath, resolveFilesPath, resolveItemsFilePath } from "../pathSafety";
import { AppError } from "../../types/errors";

const basePath = "/var/data/storage";

describe("pathSafety", () => {
    describe("resolveItemsFilePath", () => {
        it("should resolve valid relative paths under items", () => {
            expect(resolveItemsFilePath("1/2/3/file.pdf", basePath)).toBe(
                "/var/data/storage/items/1/2/3/file.pdf"
            );
        });

        it("should reject path traversal", () => {
            expect(resolveItemsFilePath("../../../../../../etc/passwd", basePath)).toBeNull();
            expect(resolveItemsFilePath("../etc/passwd", basePath)).toBeNull();
        });

        it("should reject absolute paths and null bytes", () => {
            expect(resolveItemsFilePath("/etc/passwd", basePath)).toBeNull();
            expect(resolveItemsFilePath("1/2/file\0name", basePath)).toBeNull();
        });
    });

    describe("assertSafeRelativeItemsPath", () => {
        it("should throw AppError for unsafe paths", () => {
            expect(() => assertSafeRelativeItemsPath("../../../etc/passwd", basePath)).toThrow(AppError);
        });
    });

    describe("isUnsafeRelativePath", () => {
        it("should flag dot-dot segments", () => {
            expect(isUnsafeRelativePath("1/2/../etc/passwd")).toBe(true);
        });

        it("should allow normal paths", () => {
            expect(isUnsafeRelativePath("1/2/3/file.pdf")).toBe(false);
        });
    });

    describe("resolveFilesPath", () => {
        it("should resolve valid asset names under the files root", () => {
            expect(resolveFilesPath("contract.pdf", basePath)).toBe(
                "/var/data/storage/files/contract.pdf"
            );
        });

        it("should reject traversal, absolute paths, and null bytes", () => {
            expect(resolveFilesPath("../../etc/passwd", basePath)).toBeNull();
            expect(resolveFilesPath("/etc/passwd", basePath)).toBeNull();
            expect(resolveFilesPath("a\0b", basePath)).toBeNull();
        });
    });

    describe("isSafeSegment", () => {
        it("should accept a single safe filename segment", () => {
            expect(isSafeSegment("invoice_42")).toBe(true);
            expect(isSafeSegment("frame_001.png")).toBe(true);
            expect(isSafeSegment("name with spaces")).toBe(true);
        });

        it("should reject separators, dot segments, null bytes, and empties", () => {
            expect(isSafeSegment("a/b")).toBe(false);
            expect(isSafeSegment("a\\b")).toBe(false);
            expect(isSafeSegment("..")).toBe(false);
            expect(isSafeSegment(".")).toBe(false);
            expect(isSafeSegment("a\0b")).toBe(false);
            expect(isSafeSegment("")).toBe(false);
            expect(isSafeSegment(undefined)).toBe(false);
            expect(isSafeSegment("x".repeat(256))).toBe(false);
        });

        it("should reject control characters (CR/LF/TAB/DEL) to prevent header injection", () => {
            expect(isSafeSegment("a\rb")).toBe(false);
            expect(isSafeSegment("a\nb")).toBe(false);
            expect(isSafeSegment("a\tb")).toBe(false);
            expect(isSafeSegment("a\x7fb")).toBe(false);
            expect(isSafeSegment("file\r\nContent-Length: 0")).toBe(false);
        });
    });

    describe("isSafeRelativeSubpath", () => {
        it("should accept single and nested safe sub-paths", () => {
            expect(isSafeRelativeSubpath("image.png")).toBe(true);
            expect(isSafeRelativeSubpath("images/image_1.jpg")).toBe(true);
            expect(isSafeRelativeSubpath("a/b/c/file.txt")).toBe(true);
        });

        it("should reject traversal, absolute, empty-segment, and control-char paths", () => {
            expect(isSafeRelativeSubpath("../../etc/passwd")).toBe(false);
            expect(isSafeRelativeSubpath("images/../../etc/passwd")).toBe(false);
            expect(isSafeRelativeSubpath("/etc/passwd")).toBe(false);
            expect(isSafeRelativeSubpath("images//passwd")).toBe(false);
            expect(isSafeRelativeSubpath("images\\..\\secret")).toBe(false);
            expect(isSafeRelativeSubpath("a/\nb")).toBe(false);
            expect(isSafeRelativeSubpath("")).toBe(false);
            expect(isSafeRelativeSubpath(undefined)).toBe(false);
        });
    });
});
