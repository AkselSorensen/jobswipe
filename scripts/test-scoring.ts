/**
 * Test du moteur de scoring sur des offres réelles.
 *
 * L'objectif est de vérifier que la distribution des scores est *discriminante* :
 * un moteur qui donne 80 à tout le monde ne sert à rien. On vérifie donc
 * l'étalement, et on inspecte quelques cas pour valider le raisonnement.
 *
 * Usage : pnpm tsx scripts/test-scoring.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { rechercherOffres } from "../src/lib/sources/francetravail";
import { Scorer, type CvProfil } from "../src/lib/scoring/moteur";

// Profil de test : celui du CV local (Aksel Sorensen), pour comparer avec
// les résultats que produisait le projet Python.
const CV_TEST: CvProfil = {
  competences: [
    "python", "go", "llm", "rag", "agents ia", "deep learning",
    "machine learning", "pytorch", "docker", "kubernetes", "aws",
    "postgresql", "typescript", "react", "nlp", "computer vision",
    "fastapi", "git", "linux", "opentelemetry", "grafana", "prometheus",
  ],
  anneesExperience: 7,
  postesVises: ["ingénieur ia", "lead ia", "ai engineer"],
  secteurs: ["Defense Tech", "OSINT / Renseignement"],
};

function barre(n: number, max: number, taille = 22): string {
  const pleines = max > 0 ? Math.round((n / max) * taille) : 0;
  return "█".repeat(pleines).padEnd(taille, "░");
}

async function main() {
  console.log("=== Test du moteur de scoring ===\n");

  const offres = await rechercherOffres({
    motsCles: "ingénieur ia",
    codeCommune: "75056",
    distance: 35,
    typesContrat: ["CDI"],
    limite: 150,
  });
  console.log(`${offres.length} offres récupérées\n`);

  const scorer = new Scorer(CV_TEST, { scoreMinimum: 50 });

  const debut = Date.now();
  const scores = offres.map((o) => {
    const { score, details } = scorer.scorer({
      titre: o.titre,
      entreprise: o.entreprise,
      description: o.description,
    });
    return { offre: o, score, details };
  });
  const duree = Date.now() - debut;

  console.log(
    `Scoring de ${scores.length} offres en ${duree} ms ` +
      `(${(duree / scores.length).toFixed(1)} ms/offre)\n`
  );

  // -- Distribution ---------------------------------------------------
  console.log("1. Distribution des scores");
  const tranches = [
    { nom: "85-100", min: 85, max: 101 },
    { nom: "75-84 ", min: 75, max: 85 },
    { nom: "60-74 ", min: 60, max: 75 },
    { nom: "50-59 ", min: 50, max: 60 },
    { nom: "0-49  ", min: 0, max: 50 },
  ];
  const maxTranche = Math.max(
    ...tranches.map(
      (t) => scores.filter((s) => s.score >= t.min && s.score < t.max).length
    )
  );
  for (const t of tranches) {
    const n = scores.filter((s) => s.score >= t.min && s.score < t.max).length;
    console.log(`   ${t.nom}  ${barre(n, maxTranche)}  ${n}`);
  }

  const retenues = scores.filter((s) => s.score >= 50);
  const moyenne =
    scores.reduce((a, s) => a + s.score, 0) / (scores.length || 1);
  console.log(
    `\n   moyenne : ${moyenne.toFixed(1)}  ·  retenues (≥50) : ${retenues.length}/${scores.length}`
  );

  // Un moteur qui retient plus de 80 % ou moins de 5 % ne discrimine pas
  const tauxRetenue = (retenues.length / scores.length) * 100;
  if (tauxRetenue > 80) {
    console.log("   ⚠️  Trop permissif : le seuil mérite d'être relevé.");
  } else if (tauxRetenue < 5) {
    console.log("   ⚠️  Trop strict : le seuil mérite d'être abaissé.");
  } else {
    console.log("   ✔ Pouvoir discriminant correct.");
  }

  // -- Top 5 ----------------------------------------------------------
  console.log("\n2. Meilleures correspondances");
  const top = [...scores].sort((a, b) => b.score - a.score).slice(0, 5);
  for (const s of top) {
    console.log(`\n   [${s.score.toFixed(0).padStart(3)}] ${s.offre.titre.slice(0, 62)}`);
    console.log(`         ${s.offre.entreprise.slice(0, 45)} — ${s.offre.lieu ?? "—"}`);
    console.log(
      `         titre ${s.details.titre} · comp ${s.details.competences} · ` +
        `sén ${s.details.seniorite} · sect ${s.details.secteur}`
    );
    if (s.details.motifTitre) {
      console.log(`         motif : ${s.details.motifTitre.slice(0, 55)}`);
    }
    if (s.details.competencesCouvertes.length) {
      console.log(
        `         ✔ ${s.details.competencesCouvertes.slice(0, 8).join(", ")}`
      );
    }
    if (s.details.competencesManquantes.length) {
      console.log(
        `         ✖ manque : ${s.details.competencesManquantes.slice(0, 5).join(", ")}`
      );
    }
  }

  // -- Cas limites ----------------------------------------------------
  console.log("\n3. Cas limites");

  const horsSujet = scorer.scorer({
    titre: "Chauffeur livreur",
    entreprise: "Transport Dupont",
    description: "Vous livrez des colis. Permis B requis.",
  });
  console.log(
    `   hors sujet     : ${horsSujet.score.toFixed(0)}/100 ` +
      `(attendu < 30) ${horsSujet.score < 30 ? "✔" : "✖"}`
  );

  const parfait = scorer.scorer({
    titre: "Lead AI Engineer",
    entreprise: "Thales",
    description:
      "Nous recherchons un Lead AI Engineer. Maîtrise exigée de Python, " +
      "LLM, RAG et Kubernetes. 5 ans d'expérience minimum. Secteur défense.",
  });
  console.log(
    `   correspondance : ${parfait.score.toFixed(0)}/100 ` +
      `(attendu > 80) ${parfait.score > 80 ? "✔" : "✖"}`
  );

  const vide = scorer.scorer({
    titre: "Ingénieur",
    entreprise: "X",
    description: "",
  });
  console.log(
    `   description vide : ${vide.score.toFixed(0)}/100 (neutre, ni 0 ni 100)`
  );

  // -- Exclusions -----------------------------------------------------
  console.log("\n4. Filtres d'exclusion");
  const freelance = scorer.estExclue(
    {
      titre: "Mission IA",
      entreprise: "ESN",
      description: "Mission freelance, TJM 600€, portage salarial possible.",
    },
    { description: ["freelance", "TJM", "portage salarial"] }
  );
  console.log(
    `   freelance      : ${freelance.exclue ? "✔ exclue" : "✖ NON exclue"} — ${freelance.raison}`
  );

  const stage = scorer.estExclue(
    { titre: "Stage IA", entreprise: "X", description: "" },
    { titres: ["Stage", "Alternance"] }
  );
  console.log(
    `   stage          : ${stage.exclue ? "✔ exclue" : "✖ NON exclue"} — ${stage.raison}`
  );

  const normal = scorer.estExclue(
    {
      titre: "Ingénieur IA",
      entreprise: "Thales",
      description: "CDI, équipe de 12 personnes, télétravail partiel.",
    },
    { titres: ["Stage"], description: ["freelance", "TJM"] }
  );
  console.log(
    `   offre normale  : ${normal.exclue ? "✖ exclue à tort" : "✔ conservée"}`
  );

  console.log("\n=== Tests terminés ===");
}

main().catch((e) => {
  console.error("\n✖ Échec :", e.message);
  process.exit(1);
});
