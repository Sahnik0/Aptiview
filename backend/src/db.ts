import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Fail fast with a clear message if DATABASE_URL is misconfigured
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
	// Provide actionable guidance for Render
	const msg = [
		'DATABASE_URL is not set.',
		'On Render, go to your Service -> Environment and add DATABASE_URL with a Postgres connection string.',
		'It must start with postgres:// or postgresql:// (example: postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require)',
	].join(' ');
	throw new Error(msg);
}

if (!(dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
	const redacted = dbUrl.replace(/(:\/\/)([^:@]+):[^@]+@/, (_, p1, u) => `${p1}${u}:****@`);
	const msg = [
		`Invalid DATABASE_URL format: ${redacted}`,
		'It must start with postgres:// or postgresql://.',
		'If you are using Render/Neon/Supabase, copy the full connection string and include sslmode=require when needed.',
	].join(' ');
	throw new Error(msg);
}

// Initialize Prisma
export const prisma = new PrismaClient().$extends(withAccelerate());

// Optional: proactively connect so startup fails early and clearly
prisma.$connect().catch((err) => {
	// Provide a concise error with guidance
	console.error('Failed to connect to the database. Please verify DATABASE_URL.', err?.message || err);
	process.exit(1);
});