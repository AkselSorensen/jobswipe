/**
 * Diagnostic du projet Supabase via son API REST.
 *
 * Le pooler PostgreSQL refuse l'utilisateur `postgres.<ref>` dans toutes les
 * régions, ce qui oriente vers autre chose qu'un problème de région :
 * soit le projet est en pause, soit la référence est erronée, soit la clé
 * ne correspond pas au projet.
 *
 * L'API REST, elle, répond même quand la base est en pause — elle permet
 * donc de distinguer les deux cas.
 */
import { readFileSync } from "node:fs";

function lireEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const ligne of readFileSync(".env.local", "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

async function main() {
  const env = lireEnv();
  const urlProjet = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const clePub = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  console.log("=== Diagnostic du projet Supabase ===\n");
  console.log(`URL du projet : ${urlProjet}`);

  const refUrl = urlProjet.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  console.log(`Référence (URL)  : ${refUrl}`);
  const refChaine = (env.DIRECT_URL ?? "").match(/postgres\.([^.]+)/)?.[1];
  console.log(`Référence (chaîne) : ${refChaine}`);
  if (refUrl && refChaine && refUrl !== refChaine) {
    console.log("   ⚠️  LES DEUX RÉFÉRENCES DIFFÈRENT !");
  }

  // -- 1. Le projet existe-t-il ? ------------------------------------
  console.log("\n1. Existence du projet (endpoint auth)");
  try {
    const r = await fetch(`${urlProjet}/auth/v1/health`, {
      headers: { apikey: clePub },
    });
    console.log(`   status : ${r.status}`);
    const corps = await r.text();
    console.log(`   réponse : ${corps.slice(0, 200)}`);
    if (r.status === 401) {
      console.log("   → la clé publique ne correspond pas à ce projet,");
      console.log("     OU le projet a été supprimé / recréé.");
    }
  } catch (e) {
    console.log(`   ✖ ${e instanceof Error ? e.message : e}`);
  }

  // -- 2. Réponse REST -----------------------------------------------
  console.log("\n2. API REST (table inexistante attendue)");
  try {
    const r = await fetch(`${urlProjet}/rest/v1/`, {
      headers: { apikey: clePub, Authorization: `Bearer ${clePub}` },
    });
    console.log(`   status : ${r.status}`);
    const corps = await r.text();
    console.log(`   réponse : ${corps.slice(0, 250)}`);
    if (r.status === 401) {
      console.log("   → clé refusée : projet inexistant, ou clé d'un autre projet.");
    } else if (r.status === 200 || r.status === 404) {
      console.log("   → le projet existe et la clé est valide.");
    }
  } catch (e) {
    console.log(`   ✖ ${e instanceof Error ? e.message : e}`);
  }

  // -- 3. Comparaison avec l'ancien projet (celui du .env local) -----
  console.log("\n3. Test d'un nom d'hôte alternatif");
  for (const hote of [
    `db.${refUrl}.supabase.co`,
    `aws-0-eu-west-3.pooler.supabase.com`,
  ]) {
    const { lookup } = await import("node:dns/promises");
    try {
      const r = await lookup(hote);
      console.log(`   ✔ ${hote} → ${r.address}`);
    } catch {
      console.log(`   ✖ ${hote} : ne résout pas`);
    }
  }

  console.log(
    "\n=== Interprétation ===\n" +
      "  Si l'étape 1 renvoie 401 : le projet n'existe plus ou a été recréé.\n" +
      "  Si l'étape 1 renvoie 200 : le projet existe, le problème est le\n" +
      "     mot de passe ou le nom d'utilisateur de la base."
  );
}

main();
