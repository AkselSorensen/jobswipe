/**
 * Diagnostic de connexion — teste chaque hypothèse séparément.
 *
 * Le test précédent échouait sans message d'erreur, ce qui signifie que
 * l'exception est vide ou que l'erreur vient d'ailleurs. On isole donc
 * chaque maillon : résolution DNS, atteinte du port, authentification,
 * puis requête.
 */
import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { PrismaClient } from "@prisma/client";

function lireEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

/** Vérifie qu'un host:port accepte une connexion TCP. */
function testerPort(host: string, port: number, timeout = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new Socket();
    const finir = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeout);
    sock.once("connect", () => finir(true));
    sock.once("timeout", () => finir(false));
    sock.once("error", () => finir(false));
    sock.connect(port, host);
  });
}

async function main() {
  const env = lireEnv();
  console.log("=== Diagnostic de connexion ===\n");

  // -- 1. Analyse de l'URL -------------------------------------------
  const urlDirect = env.DIRECT_URL ?? "";
  console.log("1. Analyse de DIRECT_URL");
  if (!urlDirect) {
    console.log("   ✖ absente");
    process.exit(1);
  }
  const m = urlDirect.match(
    /^postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/(.+?)(\?.*)?$/
  );
  if (!m) {
    console.log(`   ✖ format non reconnu : ${urlDirect.slice(0, 80)}`);
    process.exit(1);
  }
  const [, user, mdp, hote, portStr, base] = m;
  const port = parseInt(portStr, 10);
  console.log(`   user   : ${user}`);
  console.log(`   mot de passe : ${"*".repeat(mdp.length)} (${mdp.length} caractères)`);
  console.log(`   hôte   : ${hote}`);
  console.log(`   port   : ${port}`);
  console.log(`   base   : ${base}`);

  // -- 2. Résolution DNS ---------------------------------------------
  console.log("\n2. Résolution DNS");
  const { lookup } = await import("node:dns/promises");
  try {
    const res = await lookup(hote);
    console.log(`   ✔ ${hote} → ${res.address}`);
  } catch (e) {
    console.log(`   ✖ échec : ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  // -- 3. Port TCP ---------------------------------------------------
  console.log("\n3. Connexion TCP");
  for (const p of [5432, 6543]) {
    const ok = await testerPort(hote, p);
    console.log(`   ${ok ? "✔" : "✖"} port ${p} ${ok ? "ouvert" : "injoignable"}`);
  }

  // -- 4. Authentification PostgreSQL --------------------------------
  console.log("\n4. Authentification et requête");
  const prisma = new PrismaClient({
    datasources: { db: { url: urlDirect } },
    log: ["error", "warn"],
  });
  try {
    const r = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    console.log(`   ✔ requête réussie : ${JSON.stringify(r)}`);
  } catch (e) {
    console.log(`   ✖ échec`);
    if (e && typeof e === "object") {
      const err = e as Record<string, unknown>;
      console.log(`     name    : ${err.name}`);
      console.log(`     code    : ${err.code ?? "—"}`);
      console.log(`     message : ${String(err.message ?? "(vide)").slice(0, 200)}`);
      if (err.meta) console.log(`     meta    : ${JSON.stringify(err.meta).slice(0,150)}`);
    } else {
      console.log(`     valeur brute : ${JSON.stringify(e).slice(0, 200)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(1);
});
