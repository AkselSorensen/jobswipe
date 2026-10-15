/**
 * Pile de swipe — offres scorées pour un utilisateur.
 *
 * Le score est calculé à la volée à partir du CV, puis stocké avec la
 * décision. Les offres déjà swipées sont exclues, et seules celles qui
 * dépassent le seuil de l'utilisateur sont proposées, les meilleures d'abord.
 */
import { prisma } from "./prisma";
import { Scorer, type DetailsScore } from "./scoring/moteur";

export type Decision = "LIKE" | "PASS" | "FAVORI";

export interface OffrePile {
  id: string;
  titre: string;
  entreprise: string;
  lieu: string | null;
  contrat: string | null;
  salaire: string | null;
  description: string;
  url: string;
  source: string;
  score: number;
  details: DetailsScore;
}

/** Taille maximale de la pile servie d'un coup à l'interface. */
const TAILLE_PILE = 50;

/** Charge le scoreur de l'utilisateur, ou null si le profil est incomplet. */
export async function scoreurUtilisateur(userId: string) {
  const [cv, preferences] = await Promise.all([
    prisma.cv.findUnique({ where: { userId } }),
    prisma.preferences.findUnique({ where: { userId } }),
  ]);
  if (!cv || !preferences) return null;

  const scorer = new Scorer(
    {
      competences: cv.competences,
      anneesExperience: cv.anneesExperience,
      postesVises: cv.postesVises,
      secteurs: cv.secteurs,
    },
    { scoreMinimum: preferences.scoreMinimum }
  );
  return { scorer, preferences };
}

/** Pile d'offres à swiper : non encore décidées, au-dessus du seuil. */
export async function pileDeSwipe(userId: string): Promise<OffrePile[]> {
  const contexte = await scoreurUtilisateur(userId);
  if (!contexte) return [];
  const { scorer, preferences } = contexte;

  const dejaSwipees = await prisma.swipe.findMany({
    where: { userId },
    select: { offerId: true },
  });
  const exclues = dejaSwipees.map((s) => s.offerId);

  const offres = await prisma.offer.findMany({
    where: { id: { notIn: exclues } },
    orderBy: { vueLe: "desc" },
    take: preferences.limiteCollecte,
  });

  const notees = offres
    .map((o) => {
      const { score, details } = scorer.scorer({
        titre: o.titre,
        entreprise: o.entreprise,
        description: o.description,
      });
      return { o, score, details };
    })
    .filter(({ score }) => scorer.estRetenue(score))
    .sort((a, b) => b.score - a.score)
    .slice(0, TAILLE_PILE);

  return notees.map(({ o, score, details }) => ({
    id: o.id,
    titre: o.titre,
    entreprise: o.entreprise,
    lieu: o.lieu,
    contrat: o.contrat,
    salaire: o.salaire,
    description: o.description,
    url: o.url,
    source: o.source,
    score,
    details,
  }));
}
