/**
 * Environnement de dev local SANS Docker :
 *   1. démarre un PostgreSQL embarqué (binaires fournis par embedded-postgres)
 *   2. applique les migrations + seed
 *   3. lance l'API NestJS en watch
 *
 * Les données persistent dans backend/.pgdata entre les runs.
 * Usage : npm run dev   (puis, dans un autre terminal : cd ../frontend && npm run dev)
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PORT = 55433; // port exotique pour éviter un PostgreSQL déjà installé
const DB_URL = `postgresql://flouze:flouze@localhost:${DB_PORT}/flouze?schema=public`;

const env = {
  ...process.env,
  DATABASE_URL: DB_URL,
  JWT_SECRET: 'dev-only-secret-not-for-production',
  COOKIE_SECURE: 'false',
  CORS_ORIGIN: 'http://localhost:5173',
  PORT: '3000',
};

function run(cmd, args) {
  return spawnSync(cmd, args, { env, stdio: 'inherit', shell: true, cwd: ROOT });
}

async function main() {
  console.log(`[dev] Démarrage de PostgreSQL embarqué sur le port ${DB_PORT}…`);
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(ROOT, '.pgdata'),
    user: 'flouze',
    password: 'flouze',
    port: DB_PORT,
    persistent: true,
    // UTF8 obligatoire : sans ça initdb prend la locale Windows (WIN1252)
    // et rejette les émojis (icônes, avatars) en erreur 500.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });

  try {
    await pg.initialise();
  } catch {
    // cluster déjà initialisé (run précédent)
  }
  await pg.start();
  try {
    await pg.createDatabase('flouze');
  } catch {
    // la base existe déjà
  }

  console.log('[dev] Migrations Prisma…');
  if (run('npx', ['prisma', 'migrate', 'deploy']).status !== 0) {
    console.error('[dev] Échec des migrations');
    await pg.stop();
    process.exit(1);
  }
  run('npx', ['prisma', 'db', 'seed']);

  console.log('[dev] API NestJS en watch sur http://localhost:3000');
  const api = spawn('npx', ['nest', 'start', '--watch'], {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: ROOT,
  });

  const shutdown = async () => {
    if (process.platform === 'win32' && api.pid) {
      spawnSync('taskkill', ['/pid', String(api.pid), '/T', '/F']);
    } else {
      api.kill();
    }
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
