/**
 * Convertit la base `flouze` (créée en WIN1252 par initdb sous Windows)
 * en UTF8, sans perdre les données :
 *   1. crée `flouze_utf8` (TEMPLATE template0, ENCODING UTF8, LOCALE C)
 *   2. applique les migrations Prisma dessus (schéma frais)
 *   3. copie toutes les tables publiques
 *   4. réaligne les séquences
 *   5. renomme flouze → flouze_old, flouze_utf8 → flouze
 * Usage : node scripts/fix-encoding.mjs   (Postgres :55433 doit tourner)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'postgresql://flouze:flouze@localhost:55433';
const admin = new pg.Client(`${BASE}/postgres`);
const src = new pg.Client(`${BASE}/flouze`);
const dst = new pg.Client(`${BASE}/flouze_utf8`);

async function main() {
  await admin.connect();
  await src.connect();

  console.log('[fix] Création de flouze_utf8 (UTF8)…');
  await admin.query('DROP DATABASE IF EXISTS flouze_utf8');
  await admin.query(
    "CREATE DATABASE flouze_utf8 TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'",
  );

  console.log('[fix] Migrations Prisma sur la nouvelle base…');
  const mig = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `${BASE}/flouze_utf8?schema=public` },
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (mig.status !== 0) throw new Error('migrations échouées');

  await dst.connect();
  await dst.query("SET session_replication_role = 'replica'"); // ignore les FK pendant la copie

  const { rows: tables } = await src.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );

  for (const { tablename } of tables) {
    const { rows: cols } = await src.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [tablename],
    );
    const names = cols.map((c) => c.column_name);
    const quoted = names.map((n) => `"${n}"`).join(',');
    const { rows } = await src.query(`SELECT ${quoted} FROM "${tablename}"`);
    if (!rows.length) {
      console.log(`[fix] ${tablename}: 0 ligne`);
      continue;
    }
    const params = names.map((_, i) => `$${i + 1}`).join(',');
    for (const row of rows) {
      await dst.query(
        `INSERT INTO "${tablename}" (${quoted}) VALUES (${params})`,
        names.map((n) => row[n]),
      );
    }
    console.log(`[fix] ${tablename}: ${rows.length} lignes copiées`);
  }

  // Réaligne les séquences (compteurs serial/identity)
  const { rows: seqs } = await dst.query(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'`,
  );
  for (const { sequence_name } of seqs) {
    const { rows } = await src.query(`SELECT last_value FROM "${sequence_name}"`);
    await dst.query('SELECT setval($1, $2)', [sequence_name, rows[0].last_value]);
  }

  console.log('[fix] Renommage flouze → flouze_old, flouze_utf8 → flouze…');
  // Ferme nos connexions AVANT de terminer les backends résiduels
  await src.end();
  await dst.end();
  for (const db of ['flouze', 'flouze_utf8']) {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [db],
    );
  }
  await admin.query('ALTER DATABASE flouze RENAME TO flouze_old');
  await admin.query('ALTER DATABASE flouze_utf8 RENAME TO flouze');

  console.log('[fix] Terminé — flouze_old conservée en secours (supprimable manuellement).');
  await admin.end();
}

main().catch((e) => {
  console.error('[fix] Échec :', e);
  process.exit(1);
});
