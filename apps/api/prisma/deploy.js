/**
 * Safe migration entrypoint.
 *
 * This project historically applied its schema with `prisma db push` (no
 * migration history). We now ship real migrations. This script bridges all
 * three possible database states without any manual step:
 *
 *   1. Fresh DB               → no _prisma_migrations, no tables
 *                               → `migrate deploy` creates everything.
 *   2. Legacy db-push DB      → no _prisma_migrations, but `users` exists
 *                               → baseline `0_init` as applied, then deploy
 *                                 the remaining migrations (adds slide tables).
 *   3. Already-migrated DB    → _prisma_migrations exists
 *                               → just `migrate deploy` (applies pending).
 */
const { execSync } = require('child_process');

function sanitizeDbUrl(raw) {
  if (!raw) return raw;
  let url = raw.trim();
  // Strip wrapping quotes
  url = url.replace(/^["']|["']$/g, '');
  // Strip accidental brackets around password or user
  url = url.replace(/:\[([^\]]+)\]@/, ':$1@');
  url = url.replace(/postgres\.\[([^\]]+)\]:/, 'postgres.$1:');
  // Strip accidental brackets around host/region (not real IPv6)
  url = url.replace(/\[([a-zA-Z0-9\.\-_]+)\]/g, '$1');
  return url;
}

// Resolve DATABASE_URL (supports standard DATABASE_URL or Supabase Vercel Integration)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
}

// Resolve DIRECT_URL (supports DIRECT_URL or Supabase Vercel Integration POSTGRES_URL_NON_POOLING or fallback)
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
}

// Sanitize URLs to remove accidental brackets or quotes that cause invalid IPv6 errors
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = sanitizeDbUrl(process.env.DATABASE_URL);
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = sanitizeDbUrl(process.env.DIRECT_URL);
}

if (!process.env.DATABASE_URL || (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://'))) {
  console.warn(
    '\n[deploy] ⚠️ WARNING: DATABASE_URL is not set or invalid in environment variables!\n' +
    'Skipping Prisma migration step during build.\n'
  );
  return;
}

const { PrismaClient } = require('@prisma/client');

const BASELINE = '0_init';

async function tableExists(prisma, name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS "exists"`,
    name,
  );
  return Boolean(rows?.[0]?.exists);
}

async function main() {
  // Safe pre-check: if tableExists fails (e.g. pooler error), do not block migrate deploy
  try {
    const prisma = new PrismaClient();
    try {
      const hasMigrationsTable = await tableExists(prisma, '_prisma_migrations');
      if (!hasMigrationsTable) {
        const hasUsers = await tableExists(prisma, 'users');
        if (hasUsers) {
          console.log(
            `[deploy] Legacy db-push database detected → baselining "${BASELINE}"`,
          );
          execSync(`npx prisma migrate resolve --applied ${BASELINE}`, {
            stdio: 'inherit',
            env: process.env,
          });
        } else {
          console.log('[deploy] Fresh database → applying all migrations');
        }
      }
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch (checkErr) {
    console.warn('[deploy] Pre-check skipped (proceeding directly to migration):', checkErr.message);
  }

  console.log('[deploy] Executing prisma migrate deploy...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}

main().catch((err) => {
  console.error('[deploy] Migration bootstrap failed:', err);
  process.exit(1);
});
