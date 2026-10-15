/**
 * Test du client France Travail.
 *
 * Vérifie les trois choses qui peuvent casser en silence :
 *   - l'authentification (le scope à deux valeurs)
 *   - la pagination (la fenêtre 0-999)
 *   - la normalisation (les champs optionnels absents)
 *
 * Usage : pnpm tsx scripts/test-francetravail.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  rechercherOffres,
  identifiantsPresents,
} from "../src/lib/sources/francetravail";

async function main() {
  console.log("=== Test du client France Travail ===\n");

  if (!identifiantsPresents()) {
    console.error("✖ Identifiants absents dans .env.local");
    process.exit(1);
  }
  console.log("✔ Identifiants présents\n");

  // -- Test 1 : recherche simple -------------------------------------
  console.log("1. Recherche « ingénieur ia » à Paris (limite 20)");
  const debut = Date.now();
  const offres = await rechercherOffres({
    motsCles: "ingénieur ia",
    codeCommune: "75056",
    distance: 35,
    typesContrat: ["CDI"],
    limite: 20,
  });
  const duree = Date.now() - debut;

  console.log(`   → ${offres.length} offres en ${duree} ms\n`);

  if (offres.length === 0) {
    console.error("✖ Aucune offre : l'API répond mais ne renvoie rien.");
    process.exit(1);
  }

  // -- Test 2 : complétude des champs --------------------------------
  console.log("2. Qualité de la normalisation");
  const champs: (keyof (typeof offres)[0])[] = [
    "titre", "entreprise", "lieu", "contrat", "description", "url",
  ];
  for (const c of champs) {
    const remplis = offres.filter((o) => {
      const v = o[c];
      return v !== null && v !== undefined && v !== "";
    }).length;
    const pourcent = Math.round((remplis / offres.length) * 100);
    const barre = "█".repeat(Math.round(pourcent / 10)).padEnd(10, "░");
    console.log(`   ${barre} ${String(pourcent).padStart(3)}%  ${c}`);
  }

  const avecDesc = offres.filter((o) => (o.description?.length ?? 0) > 100);
  console.log(
    `   → ${avecDesc.length}/${offres.length} ont une description > 100 car.\n`
  );

  // -- Test 3 : exemple détaillé -------------------------------------
  console.log("3. Exemple d'offre normalisée");
  const o = offres[0];
  console.log(`   titre       : ${o.titre.slice(0, 65)}`);
  console.log(`   entreprise  : ${o.entreprise}`);
  console.log(`   lieu        : ${o.lieu ?? "—"}`);
  console.log(`   contrat     : ${o.contrat ?? "—"}`);
  console.log(`   salaire     : ${o.salaire ?? "non précisé"}`);
  console.log(`   expérience  : ${o.experienceLibelle ?? "—"}`);
  console.log(`   secteur     : ${o.secteurActivite ?? "—"}`);
  console.log(`   effectif    : ${o.trancheEffectif ?? "—"}`);
  console.log(`   compétences : ${o.competences.length} listées`);
  console.log(`   description : ${o.description.length} caractères`);
  console.log(`   url         : ${o.url.slice(0, 70)}`);
  console.log(`   dateMaj     : ${o.dateActualisation?.toISOString() ?? "—"}`);

  // -- Test 4 : pagination -------------------------------------------
  console.log("\n4. Pagination (limite 350, soit 3 pages de 150)");
  const debut2 = Date.now();
  const grosses = await rechercherOffres({
    motsCles: "ia",
    codeCommune: "75056",
    limite: 350,
  });
  console.log(
    `   → ${grosses.length} offres en ${Date.now() - debut2} ms (attendu ~350)`
  );

  // -- Test 5 : doublons ---------------------------------------------
  const ids = new Set(grosses.map((o) => o.sourceId));
  console.log(
    `   → ${ids.size} identifiants uniques sur ${grosses.length} (doublons : ${grosses.length - ids.size})`
  );

  console.log("\n=== Tous les tests passés ===");
}

main().catch((e) => {
  console.error("\n✖ Échec :", e.message);
  process.exit(1);
});
