import SafeFunctions from "../functions";

describe("SafeFunctions", () => {
    describe("parse", () => {
        it("should parse valid JSON string", () => {
            const result = SafeFunctions.parse<{ foo: string }>('{"foo":"bar"}');
            expect(result).toEqual({ foo: "bar" });
        });

        it("should return null for invalid JSON", () => {
            expect(SafeFunctions.parse("not json")).toBeNull();
            expect(SafeFunctions.parse("")).toBeNull();
            expect(SafeFunctions.parse("{ invalid }")).toBeNull();
        });

        it("should parse arrays and primitives", () => {
            expect(SafeFunctions.parse("[1,2,3]")).toEqual([1, 2, 3]);
            expect(SafeFunctions.parse("42")).toBe(42);
            expect(SafeFunctions.parse("true")).toBe(true);
        });
    });

    describe("stringify", () => {
        it("should stringify object to JSON", () => {
            const result = SafeFunctions.stringify({ foo: "bar" });
            expect(result).toBe('{"foo":"bar"}');
        });

        it("should return null when stringification fails", () => {
            const circular: any = {};
            circular.self = circular;
            expect(SafeFunctions.stringify(circular)).toBeNull();
        });

        it("should stringify primitives", () => {
            expect(SafeFunctions.stringify(42)).toBe("42");
            expect(SafeFunctions.stringify("hello")).toBe('"hello"');
        });
    });

    describe("parseNumericHeader", () => {
        it("should parse valid numeric string", () => {
            expect(SafeFunctions.parseNumericHeader("123")).toBe(123);
            expect(SafeFunctions.parseNumericHeader("1")).toBe(1);
        });

        it("should return null for undefined", () => {
            expect(SafeFunctions.parseNumericHeader(undefined)).toBeNull();
        });

        it("should return null for empty string", () => {
            expect(SafeFunctions.parseNumericHeader("")).toBeNull();
        });

        it("should use first element when given array", () => {
            expect(SafeFunctions.parseNumericHeader(["42"])).toBe(42);
        });

        it("should return null for NaN", () => {
            expect(SafeFunctions.parseNumericHeader("abc")).toBeNull();
            expect(SafeFunctions.parseNumericHeader("12.34.56")).toBeNull();
        });

        it("should return null for zero or negative", () => {
            expect(SafeFunctions.parseNumericHeader("0")).toBeNull();
            expect(SafeFunctions.parseNumericHeader("-1")).toBeNull();
        });

        it("should accept positive decimals", () => {
            expect(SafeFunctions.parseNumericHeader("1.5")).toBe(1.5);
        });
    });
});
