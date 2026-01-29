import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Config } from "../utils/config";

/**
 * Middleware to authenticate and authorize requests using SuperAnnotate API
 * 
 * Validates:
 * - Authorization token presence
 * - Required SuperAnnotate entity IDs (team, project, folder, item)
 * - Item existence and user access permissions via SuperAnnotate API
 * 
 * Required headers:
 * - path: File path
 * - expires: Expiration time
 * - signature: Signature
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response with error status if validation fails, otherwise calls next()
 */
export const localSignValidator = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response | void> => {
    const { path: filePath, expires, signature } = req.query as { path: string, expires: string, signature: string };

    if (!filePath || !expires || !signature) {
        return res.status(400).send('Missing required parameters.');
    }

    // 1. Check expiration
    console.log(Date.now());
    console.log(parseInt(expires));
    
    if (Date.now() > parseInt(expires)) {
        return res.status(403).send('URL expired.');
    }

    // 2. Re-generate the expected signature
    const dataToSign = `${filePath}-${expires}`;
    const expectedSignature = crypto.createHmac('sha256', Config.localSignSecretKey())
                                    .update(dataToSign)
                                    .digest('hex');

    // 3. Compare signatures
    if (signature === expectedSignature) {
        // Signature is valid, proceed to serve the file
        (req as any).filePath = decodeURIComponent(filePath);
        next();
    } else {
        res.status(403).send('Invalid signature.');
    }
};