/**
 * Test des variantes d'identifiants PostgreSQL.
 *
 * Le pooler Supabase refuse `postgres.<ref>` avec « tenant/user not found ».
 * Plusieurs causes possibles, et il faut les distinguer :
 *
 *   1. Le format d'utilisateur a changé (Supabase a introduit de nouveaux
 *      rôles : `postgres`, `postgres.<ref>`, ou un rôle personnalisé).
 *   2. Le mot de passe est erroné.
 *   3. Le pooler attend le format « aws-0-<region> » mais le projet est sur
 *      un pooler « aws-1-... » (nouvelle génération).
 *
 * On teste donc les combinaisons, en gardant l'hôte constant.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const REF = "nkpqmgwefhnmugdzlgtq";
const MDP = "jobshunnter";

function hoteDepuisEnv(): string {
  const contenu = readFileSync(".env.local", "utf8");
  const m = contenu.match(/DIRECT_URL="postgresql:\/\/[^@]+@([^:/]+)/);
  return m ? m[1] : "aws-0-eu-west-3.pooler.supabase.com";
}

async function tester(
  etiquette: string,
  utilisateur: string,
  hote: string,
  port: number
): Promise<boolean> {
  const url = `postgresql://${utilisateur}:${MDP}@${hote}:${port}/postgres`;
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const r = await prisma.$queryRaw<{ u: string }[]>`SELECT current_user as u`;
    console.log(`  ✔ ${etiquette}`);
    console.log(`     → connecté en tant que « ${r[0].u} »`);
    await prisma.$disconnect();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fatal = msg.match(/FATAL:[^\n"]*/)?.[0] ?? msg.split("\n")[0];
    console.log(`  ✖ ${etiquette}`);
    console.log(`     → ${fatal.slice(0, 95)}`);
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

async function main() {
  const hote = hoteDepuisEnv();
  console.log("=== Test des identifiants PostgreSQL ===\n");
  console.log(`Hôte : ${hote}`);
  console.log(`Mot de passe testé : ${"*".repeat(MDP.length)} (${MDP.length} car.)\n`);

  // -- Variantes d'utilisateur ---------------------------------------
  console.log("1. Variantes du nom d'utilisateur");
  const utilisateurs = [
    `postgres.${REF}`,
    "postgres",
    `postgres@${REF}`,
    REF,
  ];
  for (const u of utilisateurs) {
    await tester(u, u, hote, 5432);
  }

  // -- Variantes d'hôte (pooler nouvelle génération) -----------------
  console.log("\n2. Variantes d'hôte");
  const hotes = [
    hote,
    hote.replace("aws-0-", "aws-1-"),
    `aws-0-eu-west-3.pooler.supabase.com`,
    `aws-1-eu-west-3.pooler.supabase.com`,
  ];
  for (const h of [...new Set(hotes)]) {
    if (h === hote) continue;
    await tester(h, `postgres.${REF}`, h, 5432);
  }

  console.log(
    "\n=== Lecture ===\n" +
      "  Si aucune variante ne passe : le mot de passe est faux, ou le\n" +
      "  projet utilise un mot de passe différent de celui fourni.\n" +
      "  Le mot de passe se trouve dans : Dashboard → Project Settings →\n" +
      "  Database → Connection string (ou « Reset database password »)."
  );
}

main();
