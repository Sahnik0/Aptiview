"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireClerkAuth = requireClerkAuth;
const node_fetch_1 = __importDefault(require("node-fetch"));
const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
async function requireClerkAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    try {
        // Verify token with Clerk
        const verifyRes = await (0, node_fetch_1.default)('https://api.clerk.dev/v1/tokens/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CLERK_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ token }),
        });
        if (!verifyRes.ok) {
            return res.status(401).json({ error: 'Invalid Clerk token' });
        }
        const data = await verifyRes.json();
        req.clerkUserId = data?.sub || data?.user_id || data?.id || '';
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Failed to verify Clerk token' });
    }
}
