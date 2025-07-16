"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const requireClerkAuth_1 = require("../middleware/requireClerkAuth");
const router = express_1.default.Router();
// Provision user after Clerk login/signup
router.post('/provision', requireClerkAuth_1.requireClerkAuth, async (req, res) => {
    const { email, role, profile } = req.body;
    const clerkUserId = req.clerkUserId || '';
    if (!email || !role) {
        return res.status(400).json({ error: 'Missing email or role' });
    }
    try {
        let user = await db_1.prisma.user.findUnique({ where: { clerkId: clerkUserId } });
        if (!user) {
            user = await db_1.prisma.user.create({
                data: {
                    email,
                    clerkId: clerkUserId,
                    role,
                    recruiterProfile: role === 'RECRUITER' ? { create: { company: profile?.company || '', industry: profile?.industry || '' } } : undefined,
                    candidateProfile: role === 'CANDIDATE' ? { create: { education: profile?.education || '', experience: profile?.experience || '', skills: profile?.skills || '' } } : undefined,
                },
                include: { recruiterProfile: true, candidateProfile: true },
            });
        }
        res.json(user);
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
});
exports.default = router;
