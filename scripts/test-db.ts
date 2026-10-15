/**
 * Test de connexion à la base Supabase.
 *
 * Vérifie trois choses séparément, car elles échouent pour des raisons
 * différentes :
 *   1. la connexion directe (port 5432) — utilisée par les migrations
 *   2. la connexion via le pooler (port 6543) — utilisée à l'exécution
 *   3. la présence des tables après migration
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function lireEnv(): Record<string, string> {
  const contenu = readFileSync(".env.local", "utf8");
  const env: Record<string, string> = {};
  for (const ligne of contenu.split("\n")) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

async function tester(nom: string, url: string) {
  console.log(`\n${nom}`);
  console.log(`  ${url.replace(/:[^:@]+@/, ":****@").slice(0, 95)}`);

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const r = await prisma.$queryRaw<
      { db: string; usr: string; version: string }[]
    >`SELECT current_database() as db, current_user as usr, version() as version`;
    console.log(`  ✔ connexion établie`);
    console.log(`    base    : ${r[0].db}`);
    console.log(`    user    : ${r[0].usr}`);
    console.log(`    postgres: ${r[0].version.split(" ").slice(0, 2).join(" ")}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    console.log(`  ✖ échec : ${msg.slice(0, 130)}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const env = lireEnv();
  console.log("=== Test de connexion à Supabase ===\n");

  if (!env.DATABASE_URL || !env.DIRECT_URL) {
    console.error("✖ DATABASE_URL ou DIRECT_URL manquante dans .env.local");
    process.exit(1);
  }

  const okPooler = await tester("1. Pooler (port 6543 — exécution)", env.DATABASE_URL);
  const okDirect = await tester("2. Direct (port 5432 — migrations)", env.DIRECT_URL);

  // 3. Vérification des tables
  if (okDirect || okPooler) {
    const prisma = new PrismaClient({
      datasources: { db: { url: env.DIRECT_URL } },
    });
    try {
      const tables = await prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      console.log(`\n3. Tables présentes dans public (${tables.length})`);
      if (tables.length === 0) {
        console.log("   (aucune — il faut appliquer le schéma)");
      } else {
        for (const t of tables) console.log(`   • ${t.table_name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
      console.log(`\n3. ✖ lecture des tables impossible : ${msg.slice(0, 100)}`);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    `\n=== ${okDirect && okPooler ? "Connexion complète OK" : "Connexion partielle"} ===`
  );
  process.exit(okDirect || okPooler ? 0 : 1);
}

main();
