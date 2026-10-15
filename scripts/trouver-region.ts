/**
 * Détection de la région du projet Supabase.
 *
 * Supabase héberge les projets dans plusieurs régions AWS. Le nom d'hôte du
 * pooler doit correspondre : `aws-0-<region>.pooler.supabase.com`. Avec la
 * mauvaise région, la connexion TCP aboutit (le load-balancer répond) mais
 * PostgreSQL retourne « tenant/user ... not found » — message trompeur, qui
 * laisse croire à un problème d'identifiants alors que c'est la région.
 *
 * On teste donc chaque région connue jusqu'à trouver celle qui répond.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const REGIONS = [
  "eu-west-3",      // Paris
  "eu-west-1",      // Irlande
  "eu-west-2",      // Londres
  "eu-central-1",   // Francfort
  "eu-central-2",   // Zurich
  "eu-north-1",     // Stockholm
  "eu-south-1",     // Milan
  "us-east-1",      // Virginie
  "us-east-2",      // Ohio
  "us-west-1",      // Californie
  "ap-southeast-1", // Singapour
  "ap-southeast-2", // Sydney
  "ap-northeast-1", // Tokyo
  "sa-east-1",      // São Paulo
  "ca-central-1",   // Canada
];

function lireEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

async function tester(region: string, projectRef: string, motDePasse: string) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const url = `postgresql://postgres.${projectRef}:${motDePasse}@${host}:5432/postgres`;

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: [],
  });
  try {
    // La première requête déclenche réellement la connexion
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return { ok: true, message: "connexion réussie" };
  } catch (e) {
    await prisma.$disconnect().catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    const extrait = msg.match(/FATAL:[^\n"]*/)?.[0] ?? msg.slice(0, 80);
    return { ok: false, message: extrait };
  }
}

async function main() {
  const env = lireEnv();
  const m = (env.DIRECT_URL ?? "").match(
    /^postgresql:\/\/([^:]+):([^@]+)@/
  );
  if (!m) {
    console.error("✖ DIRECT_URL illisible");
    process.exit(1);
  }

  const [, userComplet, motDePasse] = m;
  const projectRef = userComplet.split(".")[1];
  if (!projectRef) {
    console.error("✖ projet non identifiable dans l'utilisateur :", userComplet);
    process.exit(1);
  }

  console.log("=== Détection de la région Supabase ===\n");
  console.log(`Projet  : ${projectRef}`);
  console.log(`Région actuelle : ${(env.DIRECT_URL.match(/aws-0-([^.]+)/) ?? [])[1] ?? "?"}\n`);

  for (const region of REGIONS) {
    process.stdout.write(`  ${region.padEnd(16)} `);
    const r = await tester(region, projectRef, motDePasse);
    if (r.ok) {
      console.log(`✔ TROUVÉE`);
      console.log(`\n=== Région correcte : ${region} ===`);
      console.log(
        `\nDATABASE_URL="postgresql://postgres.${projectRef}:${motDePasse}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"`
      );
      console.log(
        `DIRECT_URL="postgresql://postgres.${projectRef}:${motDePasse}@aws-0-${region}.pooler.supabase.com:5432/postgres"`
      );
      process.exit(0);
    }
    console.log(`✖ ${r.message.slice(0, 68)}`);
  }

  console.log("\n✖ Aucune région n'a fonctionné.");
  console.log("  → Vérifie le mot de passe, ou que le projet n'est pas en pause.");
  process.exit(1);
}

main();
