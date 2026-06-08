import { resolveItemsFilePath, resolveFilesPath, isUnsafeRelativePath, isSafeSegment } from "../../src/utils/pathSafety";

const base = "/var/data/storage";

let failed = 0;
function check(label: string, actual: boolean, expected: boolean, detail?: unknown): void {
    if (actual !== expected) {
        console.error("FAIL", label, { actual, expected, detail });
        failed++;
    } else {
        console.log("OK", label);
    }
}

// items root jail (annotation + manifest paths)
const itemsCases: Array<{ path: string; shouldResolve: boolean; shouldMarkUnsafe: boolean }> = [
    { path: "1/2/3/file.pdf", shouldResolve: true, shouldMarkUnsafe: false },
    { path: "../../../../../../etc/passwd", shouldResolve: false, shouldMarkUnsafe: true },
    { path: "/etc/passwd", shouldResolve: false, shouldMarkUnsafe: true },
    { path: "1/2/../../../etc/passwd", shouldResolve: false, shouldMarkUnsafe: true },
    { path: "1/2/foo..bar/file", shouldResolve: true, shouldMarkUnsafe: false },
];
for (const c of itemsCases) {
    check(`items resolve ${c.path}`, resolveItemsFilePath(c.path, base) !== null, c.shouldResolve);
    check(`items unsafe ${c.path}`, isUnsafeRelativePath(c.path), c.shouldMarkUnsafe);
}

// files root jail (signed raw assets)
const filesCases: Array<{ path: string; shouldResolve: boolean }> = [
    { path: "contract.pdf", shouldResolve: true },
    { path: "../../etc/passwd", shouldResolve: false },
    { path: "/etc/passwd", shouldResolve: false },
    { path: "a\0b", shouldResolve: false },
];
for (const c of filesCases) {
    check(`files resolve ${JSON.stringify(c.path)}`, resolveFilesPath(c.path, base) !== null, c.shouldResolve);
}

// single-segment validation (SA item names + manifest entries)
const segmentCases: Array<{ seg: unknown; safe: boolean }> = [
    { seg: "invoice_42", safe: true },
    { seg: "frame_001.png", safe: true },
    { seg: "a/b", safe: false },
    { seg: "a\\b", safe: false },
    { seg: "..", safe: false },
    { seg: ".", safe: false },
    { seg: "a\0b", safe: false },
    { seg: "", safe: false },
    { seg: undefined, safe: false },
    { seg: "x".repeat(256), safe: false },
];
for (const c of segmentCases) {
    check(`segment ${JSON.stringify(c.seg)}`, isSafeSegment(c.seg), c.safe);
}

if (failed > 0) {
    process.exit(1);
}
console.log("Static path safety checks passed.");
