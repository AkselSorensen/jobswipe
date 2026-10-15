/**
 * Test du parsing de CV sur le PDF réel du projet local.
 *
 * Vérifie que le parser extrait bien les compétences, les expériences et
 * l'ancienneté — et surtout qu'il SIGNALE ce qu'il n'a pas su lire, plutôt
 * que de produire un profil silencieusement incomplet.
 *
 * Usage : pnpm tsx scripts/test-cv.ts [chemin/vers/cv.pdf]
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { analyserCv } from "../src/lib/cv/parser";

const CHEMIN_DEFAUT =
  "C:/Users/azrae/Desktop/linkedin-autoapply/cv/CV_Aksel_Sorensen_ATS.pdf";

async function extraireTextePdf(chemin: string): Promise<string> {
  // pdf-parse v2 expose une classe PDFParse (et non plus une fonction).
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(chemin);
  const analyseur = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const resultat = await analyseur.getText();
    return resultat.text;
  } finally {
    await analyseur.destroy();
  }
}

async function main() {
  const chemin = process.argv[2] ?? CHEMIN_DEFAUT;

  console.log("=== Test du parsing de CV ===\n");

  if (!existsSync(chemin)) {
    console.error(`✖ Fichier introuvable : ${chemin}`);
    process.exit(1);
  }
  console.log(`Fichier : ${chemin.split("/").pop()}\n`);

  const texte = await extraireTextePdf(chemin);
  console.log(`Texte extrait : ${texte.length} caractères\n`);

  if (texte.trim().length < 100) {
    console.error(
      "✖ Extraction quasi vide : ce PDF est probablement un scan sans couche texte."
    );
    process.exit(1);
  }

  const debut = Date.now();
  const profil = analyserCv(texte);
  console.log(`Analyse en ${Date.now() - debut} ms\n`);

  // -- Compétences ----------------------------------------------------
  console.log("1. Compétences détectées");
  console.log(`   ${profil.competences.length} au total\n`);
  for (const [cat, liste] of Object.entries(profil.competencesParCategorie)) {
    console.log(`   ${cat.padEnd(20)} ${liste.length.toString().padStart(2)}  ${liste.slice(0, 7).join(", ")}${liste.length > 7 ? "…" : ""}`);
  }

  // -- Expériences ----------------------------------------------------
  console.log(`\n2. Expériences (${profil.experiences.length})`);
  for (const e of profil.experiences.slice(0, 6)) {
    console.log(`   ${e.entreprise.slice(0, 28).padEnd(30)} ${e.poste.slice(0, 30).padEnd(32)} ${e.dates}`);
  }

  // -- Profil ---------------------------------------------------------
  console.log("\n3. Profil déduit");
  console.log(`   années d'expérience : ${profil.anneesExperience}`);
  console.log(`   postes visés        : ${profil.postesVises.slice(0, 5).join(", ") || "—"}`);
  console.log(`   secteurs            : ${profil.secteurs.join(", ") || "—"}`);
  console.log(`   séniorités          : ${profil.seniorites.join(", ")}`);
  console.log(`   sections trouvées   : ${profil.sections.join(", ") || "—"}`);

  // -- Alertes --------------------------------------------------------
  console.log(`\n4. Alertes (${profil.alertes.length})`);
  if (profil.alertes.length === 0) {
    console.log("   ✔ Aucune — le parsing est complet");
  } else {
    for (const a of profil.alertes) {
      console.log(`   ⚠  ${a.slice(0, 90)}${a.length > 90 ? "…" : ""}`);
    }
  }

  // -- Verdict --------------------------------------------------------
  console.log("\n5. Verdict");
  const criteres = [
    { nom: "compétences ≥ 20", ok: profil.competences.length >= 20 },
    { nom: "expériences ≥ 2", ok: profil.experiences.length >= 2 },
    { nom: "années > 0", ok: profil.anneesExperience > 0 },
    { nom: "postes visés ≥ 1", ok: profil.postesVises.length >= 1 },
  ];
  for (const c of criteres) {
    console.log(`   ${c.ok ? "✔" : "✖"} ${c.nom}`);
  }

  const echecs = criteres.filter((c) => !c.ok).length;
  console.log(
    echecs === 0
      ? "\n=== Parsing réussi ==="
      : `\n⚠️  ${echecs} critère(s) non atteint(s) — l'écran de correction les couvrira.`
  );
}

main().catch((e) => {
  console.error("\n✖ Échec :", e.message);
  process.exit(1);
});
