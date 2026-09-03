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

// Ensure DIRECT_URL is set; fallback to DATABASE_URL if unset
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  console.log('[deploy] DIRECT_URL not provided → falling back to DATABASE_URL');
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  console.error(
    '\n[deploy] ❌ ERROR: DATABASE_URL is not set in environment variables!\n' +
    'Please add DATABASE_URL in Vercel Project Settings → Environment Variables.\n'
  );
  process.exit(1);
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
    await prisma.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}

main().catch((err) => {
  console.error('[deploy] Migration bootstrap failed:', err);
  process.exit(1);
});
