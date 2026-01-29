/**
 * Safe JSON utility class
 * Provides error-safe JSON parsing and stringification
 * Returns null instead of throwing errors on failure
 */
class SafeFunctions {
    /**
     * Safely parses a JSON string
     * Returns null if parsing fails instead of throwing an error
     * @param input - The JSON string to parse
     * @returns Parsed object of type T, or null if parsing fails
     */
    static parse<T = any>(input: string): T | null {
        try {
            return JSON.parse(input) as T;
        } catch {
            return null;
        }
    }

    /**
     * Safely stringifies a value to JSON
     * Returns null if stringification fails instead of throwing an error
     * @param value - The value to stringify (any type)
     * @returns JSON string, or null if stringification fails
     */
    static stringify(value: any): string | null {
        try {
            return JSON.stringify(value);
        } catch {
            return null;
        }
    }

    /**
     * Helper function to parse and validate numeric header values
     * @param headerValue - Header value as string
     * @param headerName - Name of the header for error messages
     * @returns Parsed number or null if invalid
     */
    static parseNumericHeader(headerValue: string | string[] | undefined, headerName: string): number | null {
        if (!headerValue) {
            return null;
        }
        const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const parsed = Number(value);
        return isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
}

export default SafeFunctions;
