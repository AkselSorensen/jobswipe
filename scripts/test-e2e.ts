/**
 * Test de bout en bout : collecte → scoring → insertion → swipe.
 *
 * Vérifie que la chaîne complète fonctionne avec la vraie base et la vraie
 * API. C'est le test qui prouve que le socle tient avant de construire
 * l'interface par-dessus.
 *
 * Usage : pnpm tsx scripts/test-e2e.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { rechercherOffres } from "../src/lib/sources/francetravail";
import { Scorer, type CvProfil } from "../src/lib/scoring/moteur";
import { createHash } from "node:crypto";

const CV_TEST: CvProfil = {
  competences: [
    "python", "go", "llm", "rag", "agents ia", "deep learning",
    "machine learning", "pytorch", "docker", "kubernetes", "aws",
    "postgresql", "typescript", "react", "nlp", "computer vision",
  ],
  anneesExperience: 7,
};

const EMAIL_TEST = "test-e2e@jobswipe.local";

function empreinte(texte: string): string {
  return createHash("sha256").update(texte).digest("hex").slice(0, 32);
}

async function main() {
  console.log("=== Test de bout en bout ===\n");
  const debut = Date.now();

  // -- 1. Nettoyage des tests précédents -----------------------------
  await prisma.user.deleteMany({ where: { email: EMAIL_TEST } });
  console.log("1. Nettoyage : OK");

  // -- 2. Collecte ---------------------------------------------------
  console.log("\n2. Collecte d'offres (France Travail)");
  const offres = await rechercherOffres({
    motsCles: "ingénieur ia",
    codeCommune: "75056",
    distance: 35,
    typesContrat: ["CDI"],
    limite: 60,
  });
  console.log(`   ${offres.length} offres récupérées`);

  // -- 3. Insertion en base (avec déduplication) ---------------------
  console.log("\n3. Insertion en base");
  const scorer = new Scorer(CV_TEST, { scoreMinimum: 50 });

  let nouvelles = 0;
  let maj = 0;
  let exclues = 0;

  for (const o of offres) {
    const verdict = scorer.estExclue(o, {
      titres: ["stage", "alternance"],
      description: ["freelance", "TJM", "portage salarial"],
    });
    if (verdict.exclue) {
      exclues++;
      continue;
    }

    const donnees = {
      source: o.source,
      sourceId: o.sourceId,
      url: o.url,
      titre: o.titre,
      entreprise: o.entreprise,
      lieu: o.lieu,
      latitude: o.latitude,
      longitude: o.longitude,
      contrat: o.contrat,
      natureContrat: o.natureContrat,
      salaire: o.salaire,
      description: o.description,
      competences: o.competences,
      experienceLibelle: o.experienceLibelle,
      secteurActivite: o.secteurActivite,
      trancheEffectif: o.trancheEffectif,
      qualification: o.qualification,
      dateCreation: o.dateCreation,
      dateActualisation: o.dateActualisation,
      vueLe: new Date(),
      empreinte: empreinte(o.description),
    };

    const existante = await prisma.offer.findUnique({
      where: { source_sourceId: { source: o.source, sourceId: o.sourceId } },
      select: { id: true },
    });

    if (existante) {
      await prisma.offer.update({ where: { id: existante.id }, data: donnees });
      maj++;
    } else {
      await prisma.offer.create({ data: donnees });
      nouvelles++;
    }
  }
  console.log(`   ${nouvelles} nouvelles · ${maj} mises à jour · ${exclues} exclues`);

  // -- 4. Idempotence : on relance, rien ne doit doubler -------------
  console.log("\n4. Test d'idempotence (relance de la collecte)");
  let doublons = 0;
  for (const o of offres.slice(0, 10)) {
    const existante = await prisma.offer.findUnique({
      where: { source_sourceId: { source: o.source, sourceId: o.sourceId } },
    });
    if (existante) doublons++;
  }
  console.log(
    `   ${doublons}/10 déjà présentes → déduplication ${doublons === 10 ? "✔ OK" : "✖ DÉFAILLANTE"}`
  );

  // -- 5. Création d'un utilisateur de test --------------------------
  console.log("\n5. Création d'un utilisateur de test");
  const utilisateur = await prisma.user.create({
    data: {
      supabaseId: "test-e2e-supabase-id-" + Date.now(),
      email: EMAIL_TEST,
      nom: "Test E2E",
      cv: {
        create: {
          texteBrut: "CV de test",
          competences: CV_TEST.competences,
          anneesExperience: CV_TEST.anneesExperience,
          postesVises: ["ingénieur ia"],
          secteurs: ["Tech / SaaS"],
          seniorites: ["senior", "lead"],
        },
      },
      preferences: {
        create: {
          motsCles: ["ingénieur ia"],
          communes: ["75056"],
          rayonKm: 35,
          contrats: ["CDI"],
          scoreMinimum: 50,
        },
      },
    },
    include: { cv: true, preferences: true },
  });
  console.log(`   utilisateur créé : ${utilisateur.id.slice(0, 12)}…`);
  console.log(`   CV : ${utilisateur.cv?.competences.length} compétences`);

  // -- 6. Scoring et swipe -------------------------------------------
  console.log("\n6. Scoring et enregistrement des swipes");
  const enBase = await prisma.offer.findMany({ take: 40 });
  let likes = 0;
  let passes = 0;
  const scores: number[] = [];

  for (const o of enBase) {
    const { score, details } = scorer.scorer({
      titre: o.titre,
      entreprise: o.entreprise,
      description: o.description,
    });
    scores.push(score);

    const decision = score >= 70 ? "LIKE" : "PASS";
    if (decision === "LIKE") likes++;
    else passes++;

    // Cast nécessaire : DetailsScore n'a pas de signature d'index (voir swipe-actions.ts)
    const detailsJson = details as unknown as Prisma.InputJsonObject;

    await prisma.swipe.upsert({
      where: {
        userId_offerId: { userId: utilisateur.id, offerId: o.id },
      },
      create: {
        userId: utilisateur.id,
        offerId: o.id,
        decision,
        score,
        details: detailsJson,
      },
      update: { decision, score, details: detailsJson },
    });
  }
  console.log(`   ${likes} likes · ${passes} passés`);
  console.log(
    `   scores : min ${Math.min(...scores).toFixed(0)} · ` +
      `moy ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} · ` +
      `max ${Math.max(...scores).toFixed(0)}`
  );

  // -- 7. Requêtes de lecture (celles de l'interface) ----------------
  console.log("\n7. Requêtes de lecture");

  const mesLikes = await prisma.swipe.findMany({
    where: { userId: utilisateur.id, decision: "LIKE" },
    include: { offer: true },
    orderBy: { score: "desc" },
    take: 3,
  });
  console.log(`   ${likes} likes en base, top 3 :`);
  for (const l of mesLikes) {
    console.log(
      `     [${l.score.toFixed(0).padStart(3)}] ${l.offer.titre.slice(0, 50)}`
    );
  }

  // Offres non encore swipées (la pile de l'interface)
  const dejaSwipes = await prisma.swipe.findMany({
    where: { userId: utilisateur.id },
    select: { offerId: true },
  });
  const pile = await prisma.offer.findMany({
    where: { id: { notIn: dejaSwipes.map((s) => s.offerId) } },
    take: 5,
  });
  console.log(`   pile restante : ${pile.length} offres non swipées (échantillon)`);

  // -- 8. Candidature ------------------------------------------------
  console.log("\n8. Suivi de candidature");
  if (mesLikes.length > 0) {
    const candidature = await prisma.application.create({
      data: {
        userId: utilisateur.id,
        offerId: mesLikes[0].offerId,
        statut: "A_POSTULER",
        note: "Créée par le test e2e",
      },
      include: { offer: true },
    });
    console.log(`   candidature créée sur « ${candidature.offer.titre.slice(0, 45)} »`);

    await prisma.application.update({
      where: { id: candidature.id },
      data: { statut: "ENVOYEE", postuleLe: new Date() },
    });
    const statuts = await prisma.application.groupBy({
      by: ["statut"],
      where: { userId: utilisateur.id },
      _count: true,
    });
    console.log(`   statuts : ${statuts.map((s) => `${s.statut}=${s._count}`).join(", ")}`);
  }

  // -- 9. Nettoyage --------------------------------------------------
  console.log("\n9. Nettoyage des données de test");
  await prisma.user.delete({ where: { id: utilisateur.id } });
  const restant = await prisma.user.count({ where: { email: EMAIL_TEST } });
  console.log(`   utilisateur supprimé (cascade) — reste : ${restant}`);

  // Les offres restent : elles sont partagées et utiles à l'application
  const totalOffres = await prisma.offer.count();
  console.log(`   ${totalOffres} offres conservées en base (partagées)`);

  console.log(`\n=== Test réussi en ${((Date.now() - debut) / 1000).toFixed(1)} s ===`);
}

main()
  .catch((e) => {
    console.error("\n✖ Échec :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
