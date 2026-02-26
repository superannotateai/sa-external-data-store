import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import chalk from "chalk";
import storageRouter from "./routes/storageRouter";
import annotationRouter from "./routes/annotationRouter";
import { sendError, errorMiddleware } from "./utils/errorHandler";

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());

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