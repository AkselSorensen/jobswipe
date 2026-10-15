"use server";

/**
 * Actions de swipe.
 *
 * Le score n'est jamais pris depuis le navigateur : il est recalculé ici à
 * partir de la base. Un client modifié ne peut donc pas fausser le tri.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utilisateurPret } from "@/lib/auth";
import { scoreurUtilisateur, type Decision } from "@/lib/swipe";

const DECISIONS: Decision[] = ["LIKE", "PASS", "FAVORI"];

export interface ResultatSwipe {
  erreur?: string;
}

export async function decider(
  offerId: string,
  decision: Decision
): Promise<ResultatSwipe> {
  if (!DECISIONS.includes(decision)) {
    return { erreur: "Décision inconnue." };
  }

  const utilisateur = await utilisateurPret();
  const contexte = await scoreurUtilisateur(utilisateur.id);
  if (!contexte) {
    return { erreur: "Profil incomplet." };
  }

  const offre = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offre) {
    return { erreur: "Offre introuvable." };
  }

  const { score, details } = contexte.scorer.scorer({
    titre: offre.titre,
    entreprise: offre.entreprise,
    description: offre.description,
  });

  // `DetailsScore` est un objet typé sans signature d'index : Prisma exige
  // un JSON générique, d'où le cast (la forme reste garantie par le moteur).
  const detailsJson = details as unknown as Prisma.InputJsonObject;

  await prisma.swipe.upsert({
    where: { userId_offerId: { userId: utilisateur.id, offerId } },
    create: { userId: utilisateur.id, offerId, decision, score, details: detailsJson },
    update: { decision, score, details: detailsJson },
  });

  return {};
}
