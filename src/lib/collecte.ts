/**
 * Collecte d'offres — France Travail → base partagée.
 *
 * Reprend la chaîne validée par `scripts/test-e2e.ts` : recherche, exclusion
 * (stages, alternance, freelance), puis insertion ou mise à jour avec
 * déduplication sur (source, sourceId). Chaque passage est journalisé dans
 * `CollecteLog` pour qu'une panne d'API ne ressemble pas à une pile vide.
 */
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import {
  rechercherOffres,
  type OffreNormalisee,
} from "./sources/francetravail";
import { Scorer } from "./scoring/moteur";

/** Exclusions appliquées à toutes les offres, en plus de celles de l'utilisateur. */
export const EXCLUSIONS_GLOBALES = {
  titres: ["stage", "alternance"],
  description: ["freelance", "TJM", "portage salarial"],
};

export interface BilanCollecte {
  recues: number;
  nouvelles: number;
  maj: number;
  exclues: number;
  erreurs: string[];
}

function empreinte(texte: string): string {
  return createHash("sha256").update(texte).digest("hex").slice(0, 32);
}

/**
 * Insère ou met à jour une liste d'offres normalisées.
 *
 * Retourne le nombre de nouvelles offres, de mises à jour et d'exclusions.
 */
export async function enregistrerOffres(
  offres: OffreNormalisee[],
  exclusions: { titres: string[]; description: string[] }
): Promise<Omit<BilanCollecte, "recues" | "erreurs">> {
  // `estExclue` ne dépend pas de l'état du scoreur : une instance vide suffit
  const verificateur = new Scorer({ competences: [], anneesExperience: 0 });
  let nouvelles = 0;
  let maj = 0;
  let exclues = 0;

  for (const o of offres) {
    if (verificateur.estExclue(o, exclusions).exclue) {
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

  return { nouvelles, maj, exclues };
}

interface PreferencesCollecte {
  motsCles: string[];
  communes: string[];
  rayonKm: number;
  contrats: string[];
  tempsPlein: boolean;
  salaireMin: number | null;
  exclusionsTitres: string[];
  exclusionsDescription: string[];
  limiteCollecte: number;
}

/**
 * Lance une collecte pour un jeu de préférences : un appel par couple
 * (mot-clé, commune). Les erreurs d'un appel n'arrêtent pas les suivants.
 */
export async function collecterPourPreferences(
  prefs: PreferencesCollecte
): Promise<BilanCollecte> {
  const debut = Date.now();
  const bilan: BilanCollecte = {
    recues: 0,
    nouvelles: 0,
    maj: 0,
    exclues: 0,
    erreurs: [],
  };

  // Une offre remontée par plusieurs recherches n'est traitée qu'une fois
  const vues = new Map<string, OffreNormalisee>();
  const communes = prefs.communes.length > 0 ? prefs.communes : [undefined];

  for (const motCle of prefs.motsCles) {
    for (const codeCommune of communes) {
      try {
        const offres = await rechercherOffres({
          motsCles: motCle,
          codeCommune,
          distance: codeCommune ? prefs.rayonKm : undefined,
          typesContrat: prefs.contrats,
          tempsPlein: prefs.tempsPlein,
          salaireMin: prefs.salaireMin ?? undefined,
          limite: prefs.limiteCollecte,
        });
        for (const o of offres) vues.set(o.sourceId, o);
      } catch (e) {
        bilan.erreurs.push(
          `« ${motCle} »${codeCommune ? ` (${codeCommune})` : ""} : ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }
  }

  bilan.recues = vues.size;

  const exclusions = {
    titres: [...EXCLUSIONS_GLOBALES.titres, ...prefs.exclusionsTitres],
    description: [
      ...EXCLUSIONS_GLOBALES.description,
      ...prefs.exclusionsDescription,
    ],
  };
  const resultat = await enregistrerOffres([...vues.values()], exclusions);
  bilan.nouvelles = resultat.nouvelles;
  bilan.maj = resultat.maj;
  bilan.exclues = resultat.exclues;

  await prisma.collecteLog.create({
    data: {
      source: "francetravail",
      recues: bilan.recues,
      nouvelles: bilan.nouvelles,
      maj: bilan.maj,
      erreur: bilan.erreurs.length ? bilan.erreurs.join("\n") : null,
      dureeMs: Date.now() - debut,
    },
  });

  return bilan;
}
