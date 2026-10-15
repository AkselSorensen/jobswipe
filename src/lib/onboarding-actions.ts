"use server";

/**
 * Onboarding — enregistrement du CV et des préférences.
 *
 * Le CV est collé en texte pour l'instant : l'extraction PDF viendra ensuite.
 * On passe par `analyserCv` pour que les compétences et l'expérience soient
 * prêtes au moment du premier swipe.
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { utilisateurRequis } from "@/lib/auth";
import { analyserCv } from "@/lib/cv/parser";
import { collecterPourPreferences } from "@/lib/collecte";

export interface EtatOnboarding {
  erreur?: string;
}

const SchemaProfil = z.object({
  texteCv: z
    .string()
    .min(200, "Le CV est trop court : colle le texte complet (200 caractères minimum)."),
  motsCles: z.string().min(2, "Indique au moins un poste recherché."),
  communes: z.string().default(""),
  rayonKm: z.coerce.number().int().min(1).max(200).default(35),
  contrat: z.enum(["CDI", "CDD", "MIS"]).default("CDI"),
  salaireMin: z.coerce.number().int().min(0).optional(),
});

/** Découpe une saisie « a, b, c » en liste propre, sans doublons. */
function listeDepuisTexte(valeur: string): string[] {
  return [
    ...new Set(
      valeur
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    ),
  ];
}

export async function enregistrerProfil(
  _etatPrecedent: EtatOnboarding,
  donnees: FormData
): Promise<EtatOnboarding> {
  const utilisateur = await utilisateurRequis();

  const analyse = SchemaProfil.safeParse({
    texteCv: donnees.get("texteCv"),
    motsCles: donnees.get("motsCles"),
    communes: donnees.get("communes") ?? "",
    rayonKm: donnees.get("rayonKm") || undefined,
    contrat: donnees.get("contrat") || undefined,
    salaireMin: donnees.get("salaireMin") || undefined,
  });
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0].message };
  }
  const saisie = analyse.data;

  const profil = analyserCv(saisie.texteCv);
  const motsCles = listeDepuisTexte(saisie.motsCles);
  const communes = listeDepuisTexte(saisie.communes);

  const donneesCv = {
    texteBrut: saisie.texteCv,
    competences: profil.competences,
    anneesExperience: profil.anneesExperience,
    postesVises: profil.postesVises,
    secteurs: profil.secteurs,
    seniorites: profil.seniorites,
  };
  const donneesPreferences = {
    motsCles,
    communes,
    rayonKm: saisie.rayonKm,
    contrats: [saisie.contrat],
    salaireMin: saisie.salaireMin ?? null,
  };

  await prisma.$transaction([
    prisma.cv.upsert({
      where: { userId: utilisateur.id },
      create: { userId: utilisateur.id, ...donneesCv },
      update: donneesCv,
    }),
    prisma.preferences.upsert({
      where: { userId: utilisateur.id },
      create: { userId: utilisateur.id, ...donneesPreferences },
      update: donneesPreferences,
    }),
  ]);

  // Première collecte tout de suite : sans cela, la pile du premier swipe
  // serait vide tant que le cron n'a pas tourné. Les erreurs sont journalisées
  // dans CollecteLog et ne bloquent pas l'onboarding.
  const preferences = await prisma.preferences.findUniqueOrThrow({
    where: { userId: utilisateur.id },
  });
  await collecterPourPreferences(preferences).catch(() => undefined);

  redirect("/swipe");
}
