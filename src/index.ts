import express, { Request, Response, NextFunction } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import chalk from "chalk";
import storageRouter from "./routes/storageRouter";
import annotationRouter from "./routes/annotationRouter";
import checkRouter from "./routes/checkRouter";
import { sendError, errorMiddleware } from "./utils/errorHandler";

const app = express();
const PORT = process.env.PORT || 3005;

// Don't advertise the framework.
app.disable("x-powered-by");

// Baseline security headers. This is a JSON/file API, not an HTML app, so the
// default CSP is unnecessary; and since signed assets are meant to be consumed
// cross-origin by the SuperAnnotate web app, Cross-Origin-Resource-Policy is set
// to "cross-origin" (helmet's default of same-origin would block embedding).
// Per-response hardening for the file-download path lives in storageRouter.
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

// Allow only https://<sub>.superannotate.com. Anchored at both ends to block
// suffix/prefix bypasses (e.g. *.superannotate.com.attacker.com or
// evilsuperannotate.com) and to require HTTPS.
const SA_ORIGIN = /^https:\/\/([a-z0-9-]+\.)+superannotate\.com$/i;

const corsOptions: CorsOptions = {
    origin(origin, callback) {
        // No Origin header => non-browser (curl, server-to-server) or same-origin.
        if (!origin) {
            callback(null, true);
            return;
        }
        callback(null, SA_ORIGIN.test(origin));
    },
};

app.use(cors(corsOptions));

// Request logging middleware (optional, for development)
if (process.env.NODE_ENV !== "production") {
    app.use((req: Request, res: Response, next: NextFunction) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Routes
app.use("/storage", storageRouter);
app.use("/annotation", annotationRouter);
app.use("/check", checkRouter);

/**
 * Health check endpoint
 * @returns 200 with { message: "OK" }
 */
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ message: "OK" });
});

// Error handling middleware (formats AppError or generic Error as JSON)
app.use(errorMiddleware);

// 404 handler (no matching route)
app.use((req: Request, res: Response) => {
    sendError(res, 404, `Route ${req.method} ${req.path} not found`);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port: ${chalk.yellow.bold(PORT)}`);
});