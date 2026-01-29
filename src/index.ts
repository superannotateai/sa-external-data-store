import express, { Request, Response, NextFunction } from "express";
import chalk from "chalk";
import dataStreamRouter from "./routes/dataStream";
import signedDownloadRouter from "./routes/signedDownload";
import fileUrlRouter from "./routes/fileDownload";

const app = express();
const PORT = process.env.PORT || 3005;

// Request logging middleware (optional, for development)
if (process.env.NODE_ENV !== "production") {
    app.use((req: Request, res: Response, next: NextFunction) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Routes
app.use("/dataStream", dataStreamRouter);
app.use("/dataUrl", signedDownloadRouter);
app.use("/file", fileUrlRouter);

/**
 * Health check endpoint
 * Returns server status
 */
app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ message: "OK" });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        timestamp: new Date().toISOString(),
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString(),
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port: ${chalk.yellow.bold(PORT)}`);
});